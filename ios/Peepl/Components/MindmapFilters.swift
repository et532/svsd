import SwiftUI

/// Glass pill at the top right of the mindmap; its menu picks what the people are grouped by.
struct MindmapFilters: View {
    @Binding var selection: GroupBy

    var body: some View {
        Menu {
            Section("Group by") {
                Picker("Group by", selection: $selection) {
                    ForEach(GroupBy.allCases, id: \.self) { Text($0.rawValue).tag($0) }
                }
                .pickerStyle(.inline)
            }
        } label: {
            HStack(spacing: 8) {
                Image(systemName: "slider.horizontal.3").font(Theme.font(16))
                Text("Filters").font(Theme.font(15, .medium))
            }
            .foregroundStyle(Theme.ink)
            .padding(.horizontal, 20)
            .frame(height: 54)
            .glassEffect(.regular, in: .capsule)
        }
        .accessibilityLabel("Filters")
    }
}
