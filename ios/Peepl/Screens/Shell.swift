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
    private var toastTask: Task<Void, Never>?

    func push(_ l: Layer) { if layers.last != l { layers.append(l) } } // a double tap must not stack the same screen twice
    func pop() { _ = layers.popLast() }
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

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()
            switch nav.tab {
            case .mindmap:
                MindmapView()
            case .connections:
                ConnectionsView()
            }
            VStack { TopControls(tab: Binding(get: { nav.tab }, set: { nav.focus = nil; nav.tab = $0 })).frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 16); Spacer() }
            VStack { Spacer(); AskBar() }
            // by position: the same profile can be on the stack twice (A -> B -> A), which a by-value id can't hold
            ForEach(Array(nav.layers.enumerated()), id: \.offset) { i, layer in
                LayerHost(layer: layer)
                    .transition(layer.isProfile ? AnyTransition.move(edge: .trailing) : AnyTransition(RevealTransition(origin: nav.revealOrigin)))
                    .zIndex(Double(i) + 1)
            }
            if let toast = nav.toast {
                VStack {
                    Spacer()
                    HStack(spacing: 8) {
                        Image(systemName: "checkmark.circle.fill").foregroundStyle(Color(hex: "d6f23c"))
                        Text(toast).foregroundStyle(.white)
                    }
                    .font(Theme.font(15, .medium))
                    .padding(.horizontal, 18).padding(.vertical, 12)
                    .background(Theme.ink, in: .capsule)
                    .padding(.bottom, 90)
                }
                .transition(.move(edge: .bottom).combined(with: .opacity))
                .zIndex(1000)
            }
        }
        .animation(.easeInOut(duration: 0.3), value: nav.layers)
        .animation(.easeInOut(duration: 0.25), value: nav.toast)
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
                Button { nav.pop() } label: {
                    Image(systemName: "xmark").font(Theme.font(16, .semibold))
                        .foregroundStyle(Theme.ink).frame(width: 44, height: 44).pastel(in: Circle())
                }
                .buttonStyle(.plain).padding(.leading, 16)
                .accessibilityLabel("Back")
            }
        }
        .offset(x: dragX)
        // Swipe in from the left edge: the profile follows the finger and the page under it shows through.
        // Past 20% of the width it leaves; less, and it springs back.
        .simultaneousGesture(DragGesture(minimumDistance: 10, coordinateSpace: .global).onChanged { v in
            if !edgeDrag, dragX == 0, v.startLocation.x < 28, v.translation.width > abs(v.translation.height) { edgeDrag = true }
            if edgeDrag { dragX = max(0, v.translation.width) }
        }.onEnded { v in
            guard edgeDrag else { return }
            edgeDrag = false
            let width = UIScreen.main.bounds.width
            if v.translation.width > width * 0.2 {
                withAnimation(.easeOut(duration: 0.2)) { dragX = width } completion: { nav.pop() }
            } else {
                withAnimation(.spring(duration: 0.3)) { dragX = 0 }
            }
        }, including: layer.isProfile ? .all : .subviews)
    }
}
