import { blobName, blobOf } from '../lib/blobs'

// A person's avatar, as in the Figma "Profile" component: a circle with a white ring, filled with a close crop of
// their Blob club character's photo (src/assets/blobs). Size it with a class: none (40px, list / results),
// avatar-sm (36px, mindmap pill), avatar-lg / avatar-xl (60px, new-person card / profile hero).
const images = import.meta.glob<string>('../assets/blobs/*.jpg', { eager: true, import: 'default' })

export function Avatar({ id, className = '' }: { id: string; className?: string }) {
  return (
    <span className={`avatar ${className}`} style={{ background: blobOf(id).soft[0] }} aria-hidden>
      <img src={images[`../assets/blobs/${blobName(id)}.jpg`]} alt="" draggable={false} />
    </span>
  )
}
