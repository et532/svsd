import Foundation

/// Web ask.ts: only the pieces Query needs so far.
enum Ask {
    /// Words that broaden a request ("sports" should find baseball and running).
    static let related: [String: [String]] = [
        "sports": ["baseball", "basketball", "soccer", "running", "tennis", "climbing", "hiking", "marathon", "run club", "sports"],
        "sport": ["baseball", "basketball", "soccer", "running", "tennis", "climbing", "hiking", "marathon", "sports"],
        "outdoors": ["hiking", "climbing", "running", "patagonia", "outdoors"],
        "tech": ["engineering", "software", "data", "robotics", "startup", "tech", "product"],
        "music": ["music", "jazz", "cello", "band", "musician"],
        "art": ["art", "design", "film", "ceramics", "pottery", "photography", "sketch", "gallery"],
        "food": ["food", "chef", "cooking", "ramen", "supper", "spicy"],
        "health": ["health", "med", "medical", "nurse", "pediatrics"],
        "climate": ["climate", "sustainab", "wildfire", "fertilizer", "passive house"],
        "money": ["investing", "investor", "vc"],
        "startups": ["founder", "startup", "startups"],
        "books": ["books", "reading", "writer", "journalist"],
        "fashion": ["fashion", "style", "stylist", "clothing", "vintage", "tailor", "runway", "apparel", "thrift", "wardrobe"],
        "photography": ["photography", "photographer", "photo", "portrait", "portraits", "film cameras"],
        "film": ["film", "movie", "movies", "cinema", "director", "screening"],
        "fitness": ["fitness", "gym", "yoga", "pilates", "lifting", "training"],
        "travel": ["travel", "trip", "abroad", "backpacking"],
        "games": ["games", "gaming", "board game", "game night", "chess"],
        "taxes": ["taxes", "tax", "accountant", "cpa", "bookkeeping"],
        "classical": ["classical", "chamber music", "orchestra", "cello", "viola", "violin", "piano", "symphony", "quartet"],
        "hardware": ["hardware", "electronics", "robotics", "embedded", "mechanical"],
    ]

    /// Words that carry no meaning for matching (the web list has a curly apostrophe in who’s / that’s).
    static let filler: Set<String> = Set((
        "who whos whom what which where when do does did i im ive me my mine you your know knows known people person " +
        "everyone everybody anyone someone somebody all show find search look looking for get give list tell about " +
        "that thats is are was were be been being the a an and or of to with into in at on from by like likes liked " +
        "love loves into interested interest interests can could would please any some who’s that’s there their them " +
        "they he she his her it its just also really guys folks lot lots much many works working work does do into " +
        "lives live living met meet meeting play plays playing played want wants need needs something"
    ).split(separator: " ").map(String.init))

    /// Lowercase, strip accents, drop ’ and '.
    static func norm(_ s: String) -> String {
        String(String.UnicodeScalarView(s.lowercased().decomposedStringWithCanonicalMapping.unicodeScalars
            .filter { !(0x300...0x36F).contains($0.value) && $0 != "’" && $0 != "'" }))
    }
}
