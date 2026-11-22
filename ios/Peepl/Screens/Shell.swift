import SwiftUI
import SwiftData

enum Layer: Hashable {
    case add(mutualOf: String?), find(voice: Bool = false), profile(String /* person id */)
}

/// Find's "Show all N in your list / on the mindmap": the list and mindmap show only these people until cleared.
struct PeopleFilter: Equatable { var ids: [String]; var label: String }

@Observable final class Nav {
    var layers: [Layer] = []
    var showFilter: PeopleFilter?
    var tab: Tab = .connections // here so Find can say "in your list" / "on the mindmap"
    /// A profile's "View connections": who the mindmap focuses, with a "← Name" pill back to them.
    var focus: (id: String, name: String)?
    /// A moment that was just logged from Add: their profile opens with it expanded.
    var fresh: String?
    var toast: String?
    /// Where Add / Find grow from (set by the ask bar before push).
    var revealOrigin = UnitPoint(x: 0.5, y: 0.95)
    /// Where Add / Find collapse to on close: the X button's centre (set by the open layer).
    var closeOrigin = UnitPoint(x: 0.1, y: 0.1)
    /// How far the top profile's edge swipe has gone (0...1), so the page under it follows the finger.
    var dragProgress: CGFloat = 0
    private var toastTask: Task<Void, Never>?

    func push(_ l: Layer) { if layers.last != l { layers.append(l) } } // a double tap must not stack the same screen twice
    /// Resigning in the same transaction as the removal makes the system keyboard slide down with the layer's shrink, not after it.
    func pop() { UIApplication.shared.sendAction(#selector(UIResponder.resignFirstResponder), to: nil, from: nil, for: nil); _ = layers.popLast() }
    func replaceTop(_ l: Layer) { if layers.isEmpty { layers.append(l) } else { layers[layers.count - 1] = l } }
    func viewConnections(_ p: Person) { layers = []; tab = .mindmap; focus = (p.id, p.firstName) }
    /// A person is being deleted: nothing may still point at them.
    func forget(_ id: String) {
        layers.removeAll { $0 == .profile(id) }
        if focus?.id == id { focus = nil }
        showFilter?.ids.removeAll { $0 == id }
        if showFilter?.ids.isEmpty == true { showFilter = nil }
    }
    func say(_ text: String) {
        toast = text
        toastTask?.cancel()
        toastTask = Task { @MainActor [weak self] in
            try? await Task.sleep(for: .seconds(2))
            if !Task.isCancelled { self?.toast = nil }
        }
    }
}

struct RootView: View {
    @Environment(\.modelContext) private var context
    @State private var nav = Nav()
    @Environment(\.accessibilityReduceMotion) private var reduce
    private var depth: CGFloat { nav.layers.last?.isProfile == true ? 1 - nav.dragProgress : 0 }

    var body: some View {
        ZStack {
            // page background lives outside the receding container, so it never scales, shifts or dims and reaches every edge
            Group {
                if nav.tab == .mindmap { Color(hex: "ededed") } else { AuraBackground(light: true) }
            }
            .ignoresSafeArea().transition(.opacity)
            .animation(Motion.animation(Motion.smooth, reduce: reduce), value: nav.tab)
            // Depth: with a profile on top, everything under it recedes (Add / Find use the circle reveal instead).
            ZStack {
            Group {
                switch nav.tab {
                case .mindmap:
                    MindmapView().transition(.opacity)
                case .connections:
                    ConnectionsView().transition(.opacity)
                }
            }
            .animation(Motion.animation(Motion.smooth, reduce: reduce), value: nav.tab)
            VStack { TopControls(tab: Binding(get: { nav.tab }, set: { nav.focus = nil; nav.tab = $0 })).frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 16); Spacer() }
            VStack { Spacer(); AskBar() }.ignoresSafeArea(.keyboard) // stays put under Add / Find instead of riding the keyboard
            }
            // the mindmap's orbs are drawn in its Canvas inside this container, so it must not scale or shift there (an edge would show); Connections' ground is separate
            .scaleEffect(reduce || nav.tab == .mindmap ? 1 : 1 - 0.04 * depth)
            .offset(x: reduce || nav.tab == .mindmap ? 0 : -30 * depth)
            // dim with an overlay, not opacity, so the ground never shows through
            .overlay { Color.black.opacity(0.05 * depth).ignoresSafeArea().allowsHitTesting(false) }
            // by position: the same profile can be on the stack twice (A -> B -> A), which a by-value id can't hold
            ForEach(Array(nav.layers.enumerated()), id: \.offset) { i, layer in
                LayerHost(layer: layer)
                    .transition(reduce ? .opacity : layer.isProfile ? AnyTransition.move(edge: .trailing) : AnyTransition.asymmetric(insertion: AnyTransition(RevealTransition(origin: nav.revealOrigin)), removal: AnyTransition(RevealTransition(origin: nav.closeOrigin))))
                    .zIndex(Double(i) + 1)
            }
            if let toast = nav.toast {
                VStack {
                    Spacer()
                    HStack(spacing: 8) {
                        Image(systemName: "checkmark.circle.fill").foregroundStyle(Color(hex: "d6f23c")).symbolEffect(.bounce, value: toast)
                        Text(toast).foregroundStyle(.white).contentTransition(.opacity)
                    }
                    .font(Theme.font(15, .medium))
                    .padding(.horizontal, 18).padding(.vertical, 12)
                    .background(Theme.ink, in: .capsule)
                    .padding(.bottom, 90)
                }
                .transition(reduce ? .opacity : .move(edge: .bottom).combined(with: .opacity).combined(with: .scale(scale: 0.92)))
                .zIndex(1000)
            }
        }
        .animation(Motion.animation(Motion.layer, reduce: reduce), value: nav.layers)
        .animation(Motion.animation(Motion.pop, reduce: reduce), value: nav.toast)
        .sensoryFeedback(.selection, trigger: nav.tab)
        .sensoryFeedback(.impact(weight: .light), trigger: nav.layers.count)
        .sensoryFeedback(.success, trigger: nav.toast) { _, new in new != nil }
        .environment(nav)
        .task {
            Seed.loadIfEmpty(context)
            #if DEBUG
            if UserDefaults.standard.string(forKey: "findQuery") != nil { nav.push(.find()) } // see FindView.preset
            #endif
        }
    }
}

private extension Layer {
    var isProfile: Bool { if case .profile = self { true } else { false } }
}

// Opaque full-screen host; later tasks replace the placeholder contents.
private struct LayerHost: View {
    let layer: Layer
    @Environment(Nav.self) private var nav
    @Environment(\.modelContext) private var context
    @State private var dragX: CGFloat = 0
    @Environment(\.accessibilityReduceMotion) private var reduce
    @State private var glyphShown = false // the X turns in as the reveal grows
    @State private var xCenter = CGPoint.zero // the X's centre in the host's own space, which is what CircleReveal resolves against
    @State private var hostSize = CGSize.zero
    private func syncOrigin() {
        guard hostSize.width > 0, hostSize.height > 0 else { return }
        nav.closeOrigin = UnitPoint(x: xCenter.x / hostSize.width, y: xCenter.y / hostSize.height)
    }
    @State private var edgeDrag = false // this drag began at the left edge and is mostly sideways

    var body: some View {
        ZStack(alignment: .topLeading) {
            if layer.isProfile { Theme.bg.ignoresSafeArea() } else { AuraBackground(light: false) }
            switch layer {
            case .profile(let id):
                if let p = try? context.fetch(FetchDescriptor<Person>(predicate: #Predicate { $0.id == id })).first {
                    ProfileView(person: p)
                } else {
                    Color.clear.onAppear { nav.layers.removeAll { $0 == layer } } // they were deleted: no dead end
                }
            case .add(let mutualOf): AddView(mutualOf: mutualOf)
            case .find(let voice): FindView(voice: voice)
            }
            if !layer.isProfile {
                Button { withAnimation(.easeOut(duration: 0.1)) { glyphShown = false }; nav.pop() } label: {
                    Image(systemName: "xmark").font(Theme.font(16, .semibold))
                        .foregroundStyle(Theme.ink)
                        .rotationEffect(.degrees(glyphShown || reduce ? 0 : -90)).opacity(glyphShown || reduce ? 1 : 0)
                        .frame(width: 44, height: 44).pastel(in: Circle())
                }
                // The dismiss shrinks into the X: set before the pop so the removal transition already has it.
                .onGeometryChange(for: CGPoint.self) { let f = $0.frame(in: .named("host")); return CGPoint(x: f.midX, y: f.midY) } action: { xCenter = $0; syncOrigin() }
                .onAppear { withAnimation(Motion.smooth.delay(0.15)) { glyphShown = true } }
                .buttonStyle(PressStyle(scale: 0.92)).padding(.leading, 16)
                .accessibilityLabel("Back")
            }
        }
        .coordinateSpace(name: "host")
        .onGeometryChange(for: CGSize.self) { $0.size } action: { hostSize = $0; syncOrigin() }
        .offset(x: dragX)
        // Swipe in from the left edge: the profile follows the finger and the page under it shows through.
        // Past 20% of the width it leaves; less, and it springs back.
        .simultaneousGesture(DragGesture(minimumDistance: 10, coordinateSpace: .global).onChanged { v in
            if !edgeDrag, dragX == 0, v.startLocation.x < 28, v.translation.width > abs(v.translation.height) { edgeDrag = true }
            if edgeDrag { dragX = max(0, v.translation.width); nav.dragProgress = min(1, dragX / UIScreen.main.bounds.width) }
        }.onEnded { v in
            guard edgeDrag else { return }
            edgeDrag = false
            let width = UIScreen.main.bounds.width
            if v.translation.width > width * 0.2 {
                withAnimation(.easeOut(duration: 0.2)) { dragX = width; nav.dragProgress = 1 } completion: { nav.pop(); nav.dragProgress = 0 }
            } else {
                withAnimation(.spring(duration: 0.3)) { dragX = 0; nav.dragProgress = 0 }
            }
        }, including: layer.isProfile ? .all : .subviews)
    }
}
