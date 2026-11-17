import SwiftUI

/// Wraps its children left to right, like text.
private struct Flow: Layout {
    func sizeThatFits(proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) -> CGSize {
        arrange(proposal.width ?? 300, subviews).size
    }
    func placeSubviews(in b: CGRect, proposal: ProposedViewSize, subviews: Subviews, cache: inout ()) {
        let a = arrange(b.width, subviews)
        for (s, p) in zip(subviews, a.points) { s.place(at: CGPoint(x: b.minX + p.x, y: b.minY + p.y), proposal: .unspecified) }
    }
    private func arrange(_ width: CGFloat, _ subviews: Subviews) -> (points: [CGPoint], size: CGSize) {
        var pts: [CGPoint] = [], x: CGFloat = 0, y: CGFloat = 0, row: CGFloat = 0, maxX: CGFloat = 0
        for s in subviews {
            let sz = s.sizeThatFits(.unspecified)
            if x > 0, x + sz.width > width { x = 0; y += row + 2; row = 0 }
            pts.append(CGPoint(x: x, y: y)); x += sz.width; row = max(row, sz.height); maxX = max(maxX, x)
        }
        return (pts, CGSize(width: maxX, height: y + row))
    }
}

/// The review note: every word of a detected name is outlined; tap one to retype it inline.
struct NameNote: View {
    @Binding var text: String
    @Binding var fixed: [(heard: String, meant: String)]
    let people: [any Named]
    let onPlain: () -> Void
    var interactive = true

    private struct Word: Identifiable { let id: Int; let text: String; let name: String?; let index: Int; var gap = true }
    @State private var editing: Int?
    @State private var typed = ""
    @FocusState private var typing: Bool

    private var words: [Word] {
        let names = NameFixes.outlines(text, people: people)
        var out: [Word] = []
        for (i, seg) in NameFixes.splitNames(text, names: names).enumerated() {
            for (j, w) in seg.split(whereSeparator: \.isWhitespace).enumerated() {
                out.append(Word(id: out.count, text: String(w), name: i % 2 == 1 ? seg : nil, index: j))
            }
        }
        // no space before punctuation that follows a name ("Voltcell,")
        for i in out.indices.dropLast() where out[i + 1].text.first.map({ $0.isPunctuation }) == true { out[i].gap = false }
        return out
    }

    var body: some View {
        Flow {
            ForEach(words) { w in
                Group {
                    if let name = w.name { nameWord(w, name) } else {
                        Text(w.text).font(.system(size: 16)).foregroundStyle(Theme.ink).padding(.vertical, 1)
                            .contentShape(.rect).onTapGesture { if interactive { onPlain() } }
                    }
                }
                .padding(.trailing, w.gap ? 4 : 0)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading).padding(.vertical, 10).padding(.leading, 6)
    }

    @ViewBuilder private func nameWord(_ w: Word, _ name: String) -> some View {
        if editing == w.id {
            // What you type overwrites the old spelling from the left: "Jor" over "Jorden" reads Jor + faded "den".
            (Text(typed).foregroundStyle(.clear) + Text(String(w.text.dropFirst(typed.count))).foregroundStyle(Theme.ink.opacity(0.3)))
                .padding(.trailing, 2)
                .overlay(alignment: .leading) {
                    TextField("", text: $typed).focused($typing).foregroundStyle(Theme.ink)
                        .autocorrectionDisabled().textInputAutocapitalization(.words)
                        .onSubmit { save(w, name) }
                }
            .font(.system(size: 16)).padding(.horizontal, 3).padding(.vertical, 1)
            .overlay(RoundedRectangle(cornerRadius: 6).stroke(Theme.ink, lineWidth: 1))
            .onAppear { typing = true }
        } else if !interactive {
            Text(w.text).font(.system(size: 16)).foregroundStyle(Theme.ink).padding(.horizontal, 3).padding(.vertical, 1)
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(Theme.ink.opacity(0.25), lineWidth: 1))
        } else {
            Button { typed = ""; editing = w.id } label: {
                Text(w.text).font(.system(size: 16)).foregroundStyle(Theme.ink).padding(.horizontal, 3).padding(.vertical, 1)
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(Theme.ink.opacity(0.25), lineWidth: 1))
            }
            .buttonStyle(.plain).accessibilityLabel("Fix the name \(w.text)")
        }
    }

    private func save(_ w: Word, _ name: String) {
        let t = typed.trimmingCharacters(in: .whitespaces)
        editing = nil
        guard !t.isEmpty, t != w.text else { return }
        text = NameFixes.rename(text, name: name, word: w.index, typed: t, people: people, fixed: &fixed)
    }
}
