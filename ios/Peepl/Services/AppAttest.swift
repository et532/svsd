import CryptoKit
import DeviceCheck
import Foundation

/// Proves to /api/ai that requests come from a genuine Peepl install (Apple App Attest), and keeps the short-lived token
/// the server hands back (server/appAttest.ts). nil means "no token": the AI then stays off and the app uses its fallbacks.
enum AppAttest {
    /// Tests replace the whole thing.
    static var override: (() async -> String?)?
    private static var cached: (token: String, exp: Date)?

    /// A token is reused until about 5 minutes before it expires.
    static func isFresh(_ exp: Date, now: Date = Date()) -> Bool { exp.timeIntervalSince(now) > 300 }

    static func token(refresh: Bool = false) async -> String? {
        if let o = override { return await o() }
        #if DEBUG
        if let t = Bundle.main.object(forInfoDictionaryKey: "PeeplDebugToken") as? String, !t.isEmpty { return t }
        #endif
        if !refresh, let c = cached, isFresh(c.exp) { return c.token }
        cached = nil
        guard DCAppAttestService.shared.isSupported else { return nil } // the Simulator
        guard let t = await attest() else { return nil }
        cached = t
        return t.token
    }

    private static func post(_ path: String, _ body: [String: Any]) async -> [String: Any]? {
        guard let url = URL(string: AIClient.base + "/api/ai/" + path) else { return nil }
        var req = URLRequest(url: url, timeoutInterval: 15)
        req.httpMethod = "POST"
        req.setValue("application/json", forHTTPHeaderField: "content-type")
        req.httpBody = try? JSONSerialization.data(withJSONObject: body)
        guard let (data, resp) = try? await AIClient.session.data(for: req), (resp as? HTTPURLResponse)?.statusCode == 200 else { return nil }
        return try? JSONSerialization.jsonObject(with: data) as? [String: Any]
    }

    /// Apple allows one attestation per key, so every new token (about hourly) comes from a fresh key.
    private static func attest() async -> (token: String, exp: Date)? {
        guard let challenge = await post("attest-challenge", [:])?["challenge"] as? String,
              let keyId = try? await DCAppAttestService.shared.generateKey(),
              let blob = try? await DCAppAttestService.shared.attestKey(keyId, clientDataHash: Data(SHA256.hash(data: Data(challenge.utf8)))),
              let out = await post("attest", ["keyId": keyId, "attestation": blob.base64EncodedString(), "challenge": challenge]),
              let token = out["token"] as? String, let exp = out["exp"] as? Double else { return nil }
        return (token, Date(timeIntervalSince1970: exp / 1000))
    }
}
