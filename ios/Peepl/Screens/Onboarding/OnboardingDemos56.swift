import SwiftUI

// Steps 5 and 6 (ONBOARDING.md 3.5, 3.6): separate 3D panels of the real Add / Find pieces, no phone frame.
// Hard-coded data only: nothing here touches the people store or the AI. All text is 15 pt or larger.

enum Step5Note {
    static let text = "Met Jorden Lee at Demo Day. Founder at Voltcell, battery recycling for e-bikes. From Seattle, lives in Brooklyn now. Climbs Tuesdays. Owe them a hardware intro."
    static let words = text.split(separator: " ").map(String.init)
    static let heard = "Jorden", meant = "Jordan"
}

enum Step6Copy {
    static let query = "coffee in SF"
    static let reason = "Furniture maker from Gowanus. He is in San Francisco that week, and always up for coffee."
    static let draft = "Hey Theo, I am in San Francisco next week. Coffee?"
}

// MARK: Step 5

private struct DemoNote: View {
    let shown: Int
    let stage: Int
    let typed: String
    private static let names: Set<String> = ["Jorden", "Lee", "Voltcell"]
    private func outlined(_ w: String) -> Bool { Self.names.contains(w.trimmingCharacters(in: .punctuationCharacters)) }

    var body: some View {
        WrapLayout(spacing: 6, lineSpacing: 6) {
            ForEach(Array(Step5Note.words.prefix(shown).enumerated()), id: \.offset) { i, w in
                if i == 1 { fixWord }
                else if outlined(w) {
                    Text(w).font(Theme.font(16)).foregroundStyle(Theme.ink).padding(.horizontal, 3)
                        .overlay(RoundedRectangle(cornerRadius: 6).stroke(Theme.ink.opacity(0.25), lineWidth: 1))
                } else { Text(w).font(Theme.font(16)).foregroundStyle(Theme.ink) }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// "Jorden": dark outline and caret while the fix is typed over it ("Jor" over "Jorden" reads Jor + faded "den").
    @ViewBuilder private var fixWord: some View {
        if stage == 4 {
            HStack(spacing: 0) {
                Text(typed).foregroundStyle(Theme.ink)
                Rectangle().fill(Theme.ink).frame(width: 1.5, height: 18)
                Text(String(Step5Note.heard.dropFirst(typed.count))).foregroundStyle(Theme.ink.opacity(0.3))
            }
            .font(Theme.font(16)).padding(.horizontal, 3).overlay(RoundedRectangle(cornerRadius: 6).stroke(Theme.ink, lineWidth: 1))
                .overlay(alignment: .bottomTrailing) { cursor }
        } else {
            Text(stage >= 5 ? Step5Note.meant : Step5Note.heard).font(Theme.font(16)).foregroundStyle(Theme.ink).padding(.horizontal, 3)
                .overlay(RoundedRectangle(cornerRadius: 6).stroke(Theme.ink.opacity(0.25), lineWidth: 1))
                .overlay(alignment: .bottomTrailing) { cursor }
        }
    }

    /// A pointer that glides to "Jorden" once the note is done and taps it as the typing starts.
    private var cursor: some View {
        let on = stage == 3 || stage == 4
        return Image(systemName: "cursorarrow").font(.system(size: 24)).foregroundStyle(Theme.ink)
            .shadow(color: .white, radius: 1)
            .scaleEffect(stage == 4 ? 0.85 : 1)
            .offset(x: on ? 8 : 70, y: on ? 14 : 60).opacity(on ? 1 : 0)
            .animation(.easeInOut(duration: 0.9), value: on).animation(.easeOut(duration: 0.15), value: stage)
            .allowsHitTesting(false)
    }
}

/// The dark, blob-colored result card (ResultCard look) with hard-coded text.
private struct DemoPersonCard: View {
    var body: some View {
        let b = Blobs.blob(for: "jordan-lee")
        HStack(spacing: 14) {
            Avatar(id: "jordan-lee", size: 60)
            VStack(alignment: .leading, spacing: 3) {
                Text("Jordan Lee").font(Theme.font(20, .medium)).foregroundStyle(.white)
                Text("Founder @ Voltcell, Brooklyn").font(Theme.font(15)).foregroundStyle(.white.opacity(0.85))
                Text("Met Oct 2026").font(Theme.font(15)).foregroundStyle(Color(hex: "cccccc"))
            }
            Spacer()
            Image(systemName: "chevron.right").foregroundStyle(.white)
        }
        .padding(18)
        .background {
            ZStack {
                Color(hex: b.base)
                Circle().fill(Color(hex: b.mid)).frame(width: 140).blur(radius: 23).offset(x: -110, y: -30)
                Circle().fill(Color(hex: b.accent)).frame(width: 110).blur(radius: 23).offset(x: 120, y: 10)
            }
        }
        .clipShape(.rect(cornerRadius: 24))
    }
}

struct Step5Demo: View {
    let stage: Int
    @State private var shown = 0
    @State private var typed = ""
    @Environment(\.accessibilityReduceMotion) private var reduce
    private static let label = "Jordan Lee's profile created from a spoken note, with the name fixed from Jorden. Misheard a name? Tap it later to fix it."

    var body: some View {
        let all = reduce || stage >= 3
        VStack(alignment: .leading, spacing: 16) {
            DemoPanel(height: 560, label: Self.label) {
                VStack(spacing: 14) {
                    Text("Tell me about a new person or moment").font(Theme.font(22)).tracking(-0.6).foregroundStyle(Theme.ink)
                        .frame(maxWidth: .infinity, alignment: .leading).padding(18).glass(20).tilted3D(10, layer: 0)
                    VStack(alignment: .leading, spacing: 12) {
                        DemoNote(shown: all ? Step5Note.words.count : shown, stage: reduce ? 7 : stage, typed: typed)
                            .frame(minHeight: 170, alignment: .topLeading)
                        HStack(spacing: 12) {
                            Waveform { stage == 2 ? Float(0.25 + 0.6 * abs(sin(Date.now.timeIntervalSinceReferenceDate * 7))) : 0 }
                                .opacity(stage == 2 ? 1 : 0.4)
                            Spacer()
                            Image(systemName: "mic.fill").font(Theme.font(20)).foregroundStyle(stage == 2 ? .white : Theme.ink)
                                .frame(width: 48, height: 48).background(stage == 2 ? Color(hex: "2F4FD0") : .white.opacity(0.7), in: Circle())
                        }
                    }
                    .padding(18).glass(24).tilted3D(10, layer: 1)
                    ZStack {
                        if reduce || stage >= 6 {
                            DemoPersonCard().tilted3D(stage >= 7 ? 6 : 10, layer: 2, lift: stage >= 7 ? 1 : 0).floatLayer(2)
                                .transition(.offset(y: 40).combined(with: .opacity))
                        }
                    }
                    .frame(height: 100)
                    .animation(Motion.animation(Motion.pop, reduce: reduce), value: stage >= 6)
                }
            }
            Text("Tap a name to change the spelling.").font(Theme.font(17)).foregroundStyle(Theme.inkMuted)
        }
        .task(id: stage >= 2) { // the words stream in, as if spoken
            guard stage >= 2, !reduce else { return }
            let per = (DemoScript.step5.cues[2] - DemoScript.step5.cues[1]) / Double(Step5Note.words.count)
            for n in 1...Step5Note.words.count { shown = n; try? await Task.sleep(for: .seconds(per)); if Task.isCancelled { return } }
        }
        .task(id: stage >= 4) { // "Jordan" typed over "Jorden", 0.18 s a letter
            guard stage >= 4, !reduce else { return }
            for n in 1...Step5Note.meant.count { typed = String(Step5Note.meant.prefix(n)); try? await Task.sleep(for: .seconds(0.18)); if Task.isCancelled { return } }
        }
    }
}

// MARK: Step 6

private struct Ripple: View {
    let go: Bool
    @State private var t = 0.0
    var body: some View {
        Circle().stroke(Theme.ink, lineWidth: 2 - 1.5 * t).frame(width: 56, height: 56)
            .scaleEffect(0.5 + 2.1 * t).opacity(go ? 0.5 * (1 - t) : 0)
            .onChange(of: go) { _, on in if on { withAnimation(.timingCurve(0.2, 0, 0, 1, duration: 0.7).delay(0.06)) { t = 1 } } }
    }
}

private struct MindmapPanel: View {
    let stage: Int
    @Environment(\.accessibilityReduceMotion) private var reduce
    private static let aisha = CGPoint(x: 230, y: 130), daniel = CGPoint(x: 90, y: 90), priya = CGPoint(x: 110, y: 250), jordan = CGPoint(x: 250, y: 270)

    private func dot(_ id: String, _ name: String, _ p: CGPoint) -> some View {
        VStack(spacing: 4) {
            Avatar(id: id, size: 56)
            Text(name).font(Theme.font(15, .medium)).foregroundStyle(Theme.ink)
        }
        .position(p)
    }

    var body: some View {
        let plopped = reduce || stage >= 2
        let nudge: CGFloat = stage == 2 && !reduce ? 8 : 0
        ZStack {
            RoundedRectangle(cornerRadius: 28).fill(LinearGradient(colors: [Color(hex: "e9e2ff"), Color(hex: "dfeaff")], startPoint: .topLeading, endPoint: .bottomTrailing))
            Path { p in
                p.move(to: Self.daniel); p.addLine(to: Self.aisha)
                p.move(to: Self.daniel); p.addLine(to: Self.priya)
                p.move(to: Self.aisha); p.addLine(to: Self.priya)
            }
            .stroke(.white, style: StrokeStyle(lineWidth: 1.5, dash: [5, 5]))
            Path { p in p.move(to: Self.jordan); p.addLine(to: Self.aisha) }
                .trim(from: 0, to: plopped ? 1 : 0).stroke(.white, lineWidth: 2)
                .animation(Motion.animation(.timingCurve(0.42, 0, 0.58, 1, duration: 0.4).delay(0.2), reduce: reduce), value: plopped)
            dot("daniel-okafor", "Daniel", Self.daniel)
            dot("priya-nair", "Priya", Self.priya)
            dot("aisha-khan", "Aisha", CGPoint(x: Self.aisha.x + nudge, y: Self.aisha.y - nudge))
                .animation(Motion.animation(.spring(duration: 0.6, bounce: 0.25).delay(0.08), reduce: reduce), value: nudge)
            Ripple(go: plopped && !reduce).position(Self.jordan)
            Avatar(id: "jordan-lee", size: 56).scaleEffect(plopped ? 1 : 0).position(Self.jordan)
                .animation(Motion.animation(.spring(duration: 0.55, bounce: 0.35), reduce: reduce), value: plopped)
            HStack(spacing: 10) {
                Avatar(id: "jordan-lee", size: 36)
                VStack(alignment: .leading, spacing: 0) {
                    Text("Jordan Lee").font(Theme.font(15, .medium)).foregroundStyle(Theme.ink)
                    Text("Founder @ Voltcell").font(Theme.font(15)).foregroundStyle(Theme.inkMuted)
                }
            }
            .padding(.vertical, 8).padding(.horizontal, 14).background(.white.opacity(0.8), in: .capsule).pastel(in: Capsule())
            .opacity(reduce || stage >= 3 ? 1 : 0).scaleEffect(reduce || stage >= 3 ? 1 : 0.92)
            .animation(Motion.animation(Motion.pop, reduce: reduce), value: stage >= 3)
            .position(x: 170, y: 340)
            Text("Jordan knows Aisha").font(Theme.mono(15)).foregroundStyle(Theme.inkMuted)
                .opacity(reduce || stage >= 3 ? 1 : 0).animation(.easeInOut(duration: 0.4).delay(0.3), value: stage >= 3)
                .position(x: 170, y: 20)
        }
        .frame(width: 340, height: 380)
        .sensoryFeedback(.impact(weight: .light), trigger: stage >= 2)
    }
}

private struct FindPanels: View {
    let stage: Int
    let typed: String
    @Environment(\.accessibilityReduceMotion) private var reduce

    var body: some View {
        let done = reduce || stage >= 7
        let shownText = done ? Step6Copy.query : typed
        VStack(spacing: 16) {
            HStack {
                Text(shownText.isEmpty ? "Ask me about people" : shownText).font(Theme.font(17)).foregroundStyle(shownText.isEmpty ? Theme.inkMuted : Theme.ink)
                Spacer()
                Image(systemName: "mic").font(Theme.font(20)).foregroundStyle(Theme.ink)
            }
            .padding(.horizontal, 20).frame(height: 56).background(.white.opacity(0.8), in: .capsule).pastel(in: Capsule())
            .tilted3D(10, layer: 0)
            .padding(.top, 36) // extra room under the header so the ask bar does not crowd it
            ZStack {
                if stage == 6 && !reduce {
                    TimelineView(.animation) { ctx in
                        HStack(spacing: 6) {
                            ForEach(0..<3, id: \.self) { i in
                                Circle().fill(Theme.ink).frame(width: 8, height: 8)
                                    .opacity((i + Int(ctx.date.timeIntervalSinceReferenceDate * 3)) % 3 == 0 ? 0.8 : 0.3)
                            }
                        }
                    }
                    .frame(maxHeight: .infinity, alignment: .top).padding(.top, 20)
                }
                if done {
                    VStack(alignment: .leading, spacing: 12) {
                        HStack(spacing: 14) {
                            Avatar(id: "theo-park", size: 44)
                            VStack(alignment: .leading, spacing: 2) {
                                Text("Theo Park").font(Theme.font(17, .medium)).foregroundStyle(Theme.ink)
                                Text("Furniture maker · Gowanus").font(Theme.font(15)).foregroundStyle(Theme.inkMuted)
                            }
                        }
                        Divider()
                        Text(Step6Copy.reason).font(Theme.font(15)).foregroundStyle(Theme.ink).fixedSize(horizontal: false, vertical: true)
                        Text(Step6Copy.draft).font(Theme.font(15)).foregroundStyle(.white).fixedSize(horizontal: false, vertical: true)
                            .padding(12).background(Theme.night, in: .rect(cornerRadius: 18))
                    }
                    .padding(18).glass(24).tilted3D(8, layer: 2).floatLayer(2)
                    .transition(.offset(y: 40).combined(with: .opacity))
                }
            }
            .frame(maxHeight: .infinity, alignment: .top)
            .animation(.easeInOut(duration: 0.5), value: done)
        }
    }
}

struct Step6Demo: View {
    let stage: Int
    @State private var typed = ""
    @State private var bShown = false
    @Environment(\.accessibilityReduceMotion) private var reduce
    private static let swing = DemoScript.step6SwingEnd - 7.0
    private static let label = "Jordan Lee joins the mindmap and is linked to Aisha Khan. Asking \"coffee in SF\" finds Theo Park, with a drafted message. Everyone connects. Then you can just ask."

    var body: some View {
        let showB = reduce ? bShown : stage >= 4
        VStack(alignment: .leading, spacing: 16) {
            DemoPanel(height: 540, label: Self.label) {
                ZStack(alignment: .top) {
                    MindmapPanel(stage: stage).tilted3D(10, layer: 0)
                        .rotation3DEffect(.degrees(showB && !reduce ? -14 : 0), axis: (x: 0, y: 1, z: 0), perspective: 0.6)
                        .opacity(showB ? 0 : 1).padding(.top, 20)
                        .animation(.easeInOut(duration: reduce ? 0.2 : Self.swing), value: showB)
                    FindPanels(stage: stage, typed: typed)
                        .rotation3DEffect(.degrees(showB || reduce ? 0 : 12), axis: (x: 0, y: 1, z: 0), perspective: 0.6)
                        .opacity(showB ? 1 : 0)
                        .animation(.easeInOut(duration: reduce ? 0.2 : Self.swing), value: showB)
                }
            }
            PipView(blob: Pip.pick(excludingBlobs: []), line: "Everyone connects. Then you can just ask.")
        }
        .task(id: stage >= 5) { // "coffee in SF", 0.1 s a character
            guard stage >= 5, !reduce else { return }
            for n in 1...Step6Copy.query.count { typed = String(Step6Copy.query.prefix(n)); try? await Task.sleep(for: .seconds(0.1)); if Task.isCancelled { return } }
        }
        .task(id: reduce) { // Reduce Motion: Scene A's final frame, then Scene B, cross-fade only
            guard reduce else { return }
            try? await Task.sleep(for: .seconds(2.5)); bShown = true
        }
    }
}
