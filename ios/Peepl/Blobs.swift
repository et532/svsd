import SwiftUI
import UIKit

// The "Blob club" avatars: each person gets one of 18 blobs (same hash as the web app's blobs.ts, so people match).
struct Blob { let soft: [String]; let base, mid, accent, deep: String }

enum Blobs {
    static let all: [(name: String, blob: Blob)] = [
        ("mint", Blob(soft: ["c6f2e3", "6fcfc0"], base: "113d48", mid: "278c79", accent: "d49b45", deep: "154c5b")),
        ("lilac", Blob(soft: ["e4d9ff", "a99cf0"], base: "272152", mid: "7562c4", accent: "e39fb8", deep: "382d70")),
        ("coral", Blob(soft: ["ffcdbf", "ff8c7a"], base: "45201d", mid: "d9604c", accent: "efb15a", deep: "74282a")),
        ("sky", Blob(soft: ["cfe6ff", "7fb6f2"], base: "132f4d", mid: "3c82d2", accent: "9bd0c4", deep: "1c4877")),
        ("pistachio", Blob(soft: ["e6f5c0", "a9d46a"], base: "22351b", mid: "78a83c", accent: "e3bf48", deep: "33501f")),
        ("apricot", Blob(soft: ["ffe0b8", "f0a95a"], base: "44291a", mid: "d9853a", accent: "f0c46a", deep: "743c1d")),
        ("aqua", Blob(soft: ["c4f1f5", "5fc9d6"], base: "0f3943", mid: "28a3b2", accent: "97d49c", deep: "145764")),
        ("rose", Blob(soft: ["ffd6df", "f291a8"], base: "481d2c", mid: "d25f7b", accent: "f0ad8c", deep: "742a42")),
        ("mango", Blob(soft: ["ffe7a6", "f5b73d"], base: "45300f", mid: "dd9c28", accent: "ec7849", deep: "745012")),
        ("sage", Blob(soft: ["dfe8d6", "93a98a"], base: "232f29", mid: "6c8b6c", accent: "c6ad78", deep: "394b3b")),
        ("jelly", Blob(soft: ["e8dcff", "b39cf0"], base: "2b2250", mid: "8a6fd1", accent: "ec9fc4", deep: "412f77")),
        ("indigo", Blob(soft: ["d5dcff", "7d8ef0"], base: "1a2054", mid: "4c60d4", accent: "8bcdec", deep: "29348c")),
        ("lemon", Blob(soft: ["fff1b8", "f2cf5c"], base: "3c3512", mid: "d2b32d", accent: "8bc268", deep: "685812")),
        ("peach", Blob(soft: ["ffe0d2", "f7a68c"], base: "47261f", mid: "e17f67", accent: "f2c078", deep: "74392e")),
        ("tangerine", Blob(soft: ["ffd2ae", "f58a3c"], base: "462310", mid: "e8772a", accent: "f1bd49", deep: "743512")),
        ("jade", Blob(soft: ["c8f0d6", "3fae78"], base: "0f3829", mid: "2e9967", accent: "d1b159", deep: "14573d")),
        ("opal", Blob(soft: ["d9dcff", "8f9ef5"], base: "1f2551", mid: "6b7bdb", accent: "e0a3d3", deep: "2e3987")),
        ("orchid", Blob(soft: ["ffd8f0", "ee8fcf"], base: "471d42", mid: "cf62b0", accent: "f0ad9e", deep: "742a68")),
    ]

    private static let assigned: [String: String] = [
        "jordan-lee": "mint", "daniel-okafor": "sky", "sofia-ramirez": "opal", "aisha-khan": "indigo", "priya-nair": "lilac",
        "tom-becker": "sage", "hannah-cohen": "jelly", "noah-patel": "aqua", "ana-ruiz": "jade", "maya-chen": "coral",
        "kenji-watanabe": "tangerine", "omar-haddad": "apricot", "jordan-smith": "peach", "zara-ahmed": "rose",
        "grace-kim": "pistachio", "lucas-silva": "lemon", "emma-wright": "orchid", "liam-oconnor": "mango",
    ]

    // FNV-1a over UTF-16 units, like the web app's charCodeAt hash.
    private static func hash(_ id: String) -> UInt32 {
        var h: UInt32 = 2166136261
        for c in id.utf16 { h = (h ^ UInt32(c)) &* 16777619 }
        return h
    }

    static func name(for id: String) -> String { assigned[id] ?? all[Int(hash(id)) % all.count].name }
    static func blob(for id: String) -> Blob { all.first { $0.name == name(for: id) }!.blob }

    private static let cache = NSCache<NSString, UIImage>()
    static func image(_ name: String) -> UIImage? {
        if let c = cache.object(forKey: name as NSString) { return c }
        guard let path = Bundle.main.path(forResource: name, ofType: "jpg"), let img = UIImage(contentsOfFile: path) else { return nil }
        cache.setObject(img, forKey: name as NSString)
        return img
    }
}

// The Figma "Profile" avatar: a circle with a white ring, filled with a close crop of the blob photo.
struct Avatar: View {
    let id: String
    var size: CGFloat = 40

    var body: some View {
        let blob = Blobs.blob(for: id)
        ZStack {
            LinearGradient(colors: blob.soft.map { Color(hex: $0) }, startPoint: .top, endPoint: .bottom)
            if let img = Blobs.image(Blobs.name(for: id)) {
                Image(uiImage: img).resizable().scaledToFill().scaleEffect(size >= 60 ? 2.3 : 2.6)
            }
        }
        .frame(width: size, height: size)
        .clipShape(Circle())
        .overlay(Circle().stroke(.white, lineWidth: 2))
    }
}
