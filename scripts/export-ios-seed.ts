// Writes the sample people as JSON for the native iOS app: npx tsx scripts/export-ios-seed.ts
import { writeFileSync } from 'node:fs'
import { samplePeople } from '../src/data/people'

writeFileSync('ios/Peepl/Resources/seed.json', JSON.stringify(samplePeople))
console.log(`ios/Peepl/Resources/seed.json: ${samplePeople.length} people`)
