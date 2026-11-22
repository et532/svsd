# rel2 queue (OpenAI opt-in ships, default off; PLAN 12.6 Q1 answered)
Disjoint files, all three can run in parallel (each builder uses its own simulator where needed; rel-e needs none):
- rel-c: PrivacyInfo.xcprivacy, PrivacyManifestTests.
- rel-d: SettingsView.swift, AIClient.swift (gate only), ConsentView.swift, ConsentTests, plus the consent line in AI*Tests setUp.
- rel-e: public/privacy.html.
Each: builder -> independent validator (brief + branch only) -> lead merges on PASS.
Needs Vince afterwards: support email and OpenAI data-use wording in privacy.html; deploy of the page (npx vercel --prod); Supabase project and Apple Developer enrollment before any public OpenAI use (section 11 A to D, G).
