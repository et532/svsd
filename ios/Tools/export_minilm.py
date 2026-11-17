"""One-off: export the q8 all-MiniLM-L6-v2 ONNX weights for the Swift forward pass, then check a numpy
reference forward pass against public/vectors.json.  Run from the repo root:
  python -I ios/Tools/export_minilm.py
"""
import json, math, os, re, sys, unicodedata
import numpy as np, onnx
from onnx import numpy_helper

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
SRC = '/Users/vincelin/Documents/Peepl/node_modules/@huggingface/transformers/.cache/Xenova/all-MiniLM-L6-v2'
OUT = os.path.join(ROOT, 'ios/Peepl/Resources/MiniLM')
MAXLEN = 128

m = onnx.load(f'{SRC}/onnx/model_quantized.onnx')
ini = {i.name: numpy_helper.to_array(i) for i in m.graph.initializer}
T = {}  # my name -> ndarray
T['emb.ln.w'] = ini['embeddings.LayerNorm.weight']; T['emb.ln.b'] = ini['embeddings.LayerNorm.bias']
for n, k in (('word', 'word_embeddings'), ('tok', 'token_type_embeddings'), ('pos', 'position_embeddings')):
    q = ini[f'embeddings.{k}.weight_quantized']
    T[f'{n}.q'] = q[:MAXLEN] if n == 'pos' else q  # only 128 positions are ever used
    T[f'{n}.s'] = ini[f'embeddings.{k}.weight_scale'].reshape(1).astype(np.float32)
    T[f'{n}.z'] = ini[f'embeddings.{k}.weight_zero_point'].reshape(1).astype(np.float32)
KINDS = {'attention/self/query': 'q', 'attention/self/key': 'k', 'attention/self/value': 'v',
         'attention/output/dense': 'o', 'intermediate/dense': 'i', 'output/dense': 'd'}
BIAS = {'q': 'attention.self.query', 'k': 'attention.self.key', 'v': 'attention.self.value',
        'o': 'attention.output.dense', 'i': 'intermediate.dense', 'd': 'output.dense'}
for n in m.graph.node:
    if n.op_type != 'MatMulInteger': continue
    mt = re.match(r'/encoder/layer\.(\d+)/(.+)/MatMul_quant', n.name)
    L, kind = mt.group(1), KINDS[mt.group(2)]
    w = n.input[1][:-len('_quantized')]
    T[f'L{L}.{kind}.q'] = ini[w + '_quantized']
    T[f'L{L}.{kind}.s'] = ini[w + '_scale'].astype(np.float32)
    T[f'L{L}.{kind}.z'] = ini[w + '_zero_point'].astype(np.float32)
for L in range(6):
    for kind, b in BIAS.items(): T[f'L{L}.{kind}.b'] = ini[f'encoder.layer.{L}.{b}.bias']
    for ln, p in (('ln1', 'attention.output'), ('ln2', 'output')):
        T[f'L{L}.{ln}.w'] = ini[f'encoder.layer.{L}.{p}.LayerNorm.weight']
        T[f'L{L}.{ln}.b'] = ini[f'encoder.layer.{L}.{p}.LayerNorm.bias']

# blob + manifest
manifest, off = {}, 0
with open(f'{OUT}/weights.bin', 'wb') as f:
    for name, a in T.items():
        dt = {np.dtype('uint8'): 'u8', np.dtype('int8'): 'i8', np.dtype('float32'): 'f32'}[a.dtype]
        b = np.ascontiguousarray(a).tobytes()
        manifest[name] = {'dtype': dt, 'shape': list(a.shape), 'offset': off}
        f.write(b); off += len(b)
json.dump({'maxLen': MAXLEN, 'hidden': 384, 'heads': 12, 'layers': 6, 'tensors': manifest}, open(f'{OUT}/manifest.json', 'w'))
tk = json.load(open(f'{SRC}/tokenizer.json'))
vocab = tk['model']['vocab']
open(f'{OUT}/vocab.txt', 'w').write('\n'.join(t for t, _ in sorted(vocab.items(), key=lambda x: x[1])) + '\n')
print('blob bytes', off)

# ---- numpy reference ----
def deq(n):  # -> float32 matrix [in,out]
    return (T[n + '.q'].astype(np.float32) - T[n + '.z']) * T[n + '.s']
def basic(text):
    text = unicodedata.normalize('NFD', text.lower())
    text = ''.join(c for c in text if unicodedata.category(c) != 'Mn')
    out, cur = [], ''
    for c in text:
        if c.isspace():
            if cur: out.append(cur); cur = ''
        elif unicodedata.category(c).startswith('P') or unicodedata.category(c).startswith('S') and ord(c) < 128 or (ord(c) < 128 and not c.isalnum()):
            if cur: out.append(cur); cur = ''
            out.append(c)
        else: cur += c
    if cur: out.append(cur)
    return out
def wordpiece(w):
    if len(w) > 100: return [vocab['[UNK]']]
    ids, s = [], 0
    while s < len(w):
        e, found = len(w), None
        while s < e:
            p = ('##' if s else '') + w[s:e]
            if p in vocab: found = vocab[p]; break
            e -= 1
        if found is None: return [vocab['[UNK]']]
        ids.append(found); s = e
    return ids
def tokenize(text):
    ids = [vocab['[CLS]']] + [i for w in basic(text) for i in wordpiece(w)]
    return ids[:MAXLEN - 1] + [vocab['[SEP]']]
def ln(x, w, b): 
    mu = x.mean(-1, keepdims=True); v = ((x - mu) ** 2).mean(-1, keepdims=True)
    return (x - mu) / np.sqrt(v + 1e-12) * w + b
from math import erf
verf = np.vectorize(erf)
def embed(text):
    ids = tokenize(text); n = len(ids)
    emb = lambda k, i: (T[k + '.q'][i].astype(np.float32) - T[k + '.z']) * T[k + '.s']
    x = ln(emb('word', ids) + emb('tok', np.zeros(n, int)) + emb('pos', np.arange(n)), T['emb.ln.w'], T['emb.ln.b'])
    for L in range(6):
        lin = lambda h, k: h @ deq(f'L{L}.{k}') + T[f'L{L}.{k}.b']
        q, k, v = (lin(x, c).reshape(n, 12, 32).transpose(1, 0, 2) for c in 'qkv')
        s = q @ k.transpose(0, 2, 1) / math.sqrt(32); s = np.exp(s - s.max(-1, keepdims=True)); s /= s.sum(-1, keepdims=True)
        a = (s @ v).transpose(1, 0, 2).reshape(n, 384)
        x = ln(lin(a, 'o') + x, T[f'L{L}.ln1.w'], T[f'L{L}.ln1.b'])
        h = lin(x, 'i'); h = h * 0.5 * (1 + verf(h / math.sqrt(2)))
        x = ln(lin(h, 'd') + x, T[f'L{L}.ln2.w'], T[f'L{L}.ln2.b'])
    e = x.mean(0); return e / np.linalg.norm(e)

if '--check' in sys.argv or True:
    import base64
    raw = json.load(open(f'{ROOT}/public/vectors.json'))
    texts = list(raw)[::len(raw) // 50][:50]
    cs = []
    for t in texts:
        v = np.frombuffer(base64.b64decode(raw[t]), dtype=np.int8).astype(np.float32) / 300
        cs.append(float(embed(t) @ v / np.linalg.norm(v)))
    print('numpy parity: mean %.4f min %.4f' % (np.mean(cs), np.min(cs)))
