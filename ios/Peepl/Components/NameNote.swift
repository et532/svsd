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

    /// `tail`: what is glued to a name ("," in "Voltcell,"); one view with it, so it can't wrap alone onto the next line.
    private struct Word: Identifiable { let id: Int; let text: String; let name: String?; let index: Int; var tail = "" }
    @State private var editing: Int?
    @State private var typed = ""
    @FocusState private var typing: Bool

    private var words: [Word] {
        let names = NameFixes.outlines(text, people: people)
        var out: [Word] = []
        for (i, seg) in NameFixes.splitNames(text, names: names).enumerated() {
            var parts = seg.split(whereSeparator: \.isWhitespace).map(String.init)
            if i % 2 == 0, !out.isEmpty, let f = seg.first, !f.isWhitespace { out[out.count - 1].tail = parts.removeFirst() }
            for (j, w) in parts.enumerated() {
                out.append(Word(id: out.count, text: w, name: i % 2 == 1 ? seg : nil, index: j))
            }
        }
        return out
    }

    var body: some View {
        Flow {
            ForEach(words) { w in
                HStack(spacing: 0) {
                    if let name = w.name { nameWord(w, name) }
                    Text(w.name == nil ? w.text : w.tail).font(Theme.font(16)).foregroundStyle(Theme.ink).padding(.vertical, 1)
                        .contentShape(.rect).onTapGesture { if interactive { onPlain() } }
                }
                .padding(.trailing, 4)
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
            .font(Theme.font(16)).padding(.horizontal, 3).padding(.vertical, 1)
            .overlay(RoundedRectangle(cornerRadius: 6).stroke(Theme.ink, lineWidth: 1))
            .onAppear { typing = true }
        } else if !interactive {
            Text(w.text).font(Theme.font(16)).foregroundStyle(Theme.ink).padding(.horizontal, 3).padding(.vertical, 1)
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(Theme.ink.opacity(0.25), lineWidth: 1))
        } else {
            Button { typed = ""; editing = w.id } label: {
                Text(w.text).font(Theme.font(16)).foregroundStyle(Theme.ink).padding(.horizontal, 3).padding(.vertical, 1)
                    .overlay(RoundedRectangle(cornerRadius: 6).stroke(Theme.ink.opacity(0.25), lineWidth: 1))
            }
            .buttonStyle(PressStyle(scale: 0.95)).accessibilityLabel("Fix the name \(w.text)")
        }
    }

    private func save(_ w: Word, _ name: String) {
        let t = typed.trimmingCharacters(in: .whitespaces)
        editing = nil
        guard !t.isEmpty, t != w.text else { return }
        text = NameFixes.rename(text, name: name, word: w.index, typed: t, people: people, fixed: &fixed)
    }
}

/// Marks a word as part of a name, for `NameOutlines`.
private struct OutlinedWord: TextAttribute {}

/// Strokes a rounded outline around every marked word and draws no text.
private struct OutlineRenderer: TextRenderer {
    func draw(layout: Text.Layout, in ctx: inout GraphicsContext) {
        for line in layout {
            for run in line where run[OutlinedWord.self] != nil {
                ctx.stroke(Path(roundedRect: run.typographicBounds.rect.insetBy(dx: -2.5, dy: 0), cornerRadius: 6),
                           with: .color(Theme.ink.opacity(0.25)), lineWidth: 1)
            }
        }
    }
}

/// The outlines alone, laid out like the text itself: sits under the field while you type (the web's invisible mirror).
struct NameOutlines: View {
    let text: String
    let people: [any Named]

    var body: some View {
        let segs = NameFixes.splitNames(text, names: NameFixes.outlines(text, people: people))
        let names = segs.enumerated().filter { $0.offset % 2 == 1 }.map(\.element)
        segs.enumerated().reduce(Text("")) { all, seg in
            guard seg.offset % 2 == 1 else { return all + Text(seg.element) }
            // each word of a name is outlined on its own
            return seg.element.split(separator: " ", omittingEmptySubsequences: false).enumerated().reduce(all) {
                $0 + Text($1.offset > 0 ? " " : "") + Text($1.element).customAttribute(OutlinedWord())
            }
        }
        .font(Theme.font(16)).foregroundStyle(.clear)
        .textRenderer(OutlineRenderer())
        .accessibilityElement().accessibilityLabel(names.isEmpty ? "" : "Names found: " + names.joined(separator: ", "))
        .accessibilityHidden(names.isEmpty)
    }
}
