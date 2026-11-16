import SwiftUI
import SwiftData

enum Layer: Hashable, Identifiable {
    case add(mutualOf: String?), find, profile(String /* person id */)
    var id: Self { self }
}

@Observable final class Nav {
    var layers: [Layer] = []
    var toast: String?
    private var toastTask: Task<Void, Never>?

    func push(_ l: Layer) { layers.append(l) }
    func pop() { _ = layers.popLast() }
    func replaceTop(_ l: Layer) { if layers.isEmpty { layers.append(l) } else { layers[layers.count - 1] = l } }
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
    @State private var tab: Tab = .connections

    var body: some View {
        ZStack {
            Theme.bg.ignoresSafeArea()
            switch tab {
            case .mindmap:
                (Text("Mindmap is ").font(.system(size: 32, weight: .light)) + Text("coming soon").font(.system(size: 32, weight: .semibold)))
                    .tracking(-1.28).foregroundStyle(Theme.ink).multilineTextAlignment(.center).padding(24)
            case .connections:
                ConnectionsView()
            }
            VStack { TopControls(tab: $tab).frame(maxWidth: .infinity, alignment: .leading).padding(.horizontal, 16); Spacer() }
            VStack { Spacer(); AskBar() }
            ForEach(nav.layers) { layer in
                LayerHost(layer: layer)
                    .transition(layer.isProfile ? .move(edge: .trailing) : .scale(scale: 0.96).combined(with: .opacity))
                    .zIndex(Double(nav.layers.firstIndex(of: layer) ?? 0) + 1)
            }
            if let toast = nav.toast {
                VStack {
                    Spacer()
                    HStack(spacing: 8) {
                        Image(systemName: "checkmark.circle.fill").foregroundStyle(Color(hex: "d6f23c"))
                        Text(toast).foregroundStyle(.white)
                    }
                    .font(.system(size: 15, weight: .medium))
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
        .environment(nav)
        .task { Seed.loadIfEmpty(context) }
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

    var body: some View {
        ZStack(alignment: .topLeading) {
            Theme.bg.ignoresSafeArea()
            switch layer {
            case .profile(let id):
                if let p = try? context.fetch(FetchDescriptor<Person>(predicate: #Predicate { $0.id == id })).first {
                    ProfileView(person: p)
                }
            case .add(let mutualOf): AddView(mutualOf: mutualOf)
            case .find: Text("Find").frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            if !layer.isProfile {
                Button { nav.pop() } label: {
                    Image(systemName: "xmark").font(.system(size: 16, weight: .semibold))
                        .foregroundStyle(Theme.ink).frame(width: 44, height: 44).glassEffect(.regular, in: .circle)
                }
                .buttonStyle(.plain).padding(.leading, 16)
                .accessibilityLabel("Back")
            }
        }
    }
}
