import { AddPersonIcon, MicIcon } from './Icons'

// Each handler gets the tap, so the screen it opens can grow out of that button
type Props = {
  onType: (e: React.MouseEvent<HTMLElement>) => void
  onVoice: (e: React.MouseEvent<HTMLElement>) => void
  onAdd: (e: React.MouseEvent<HTMLElement>) => void
}

// Bottom of the app: ask about people (type or speak), or add someone / a moment.
export function AskBar({ onType, onVoice, onAdd }: Props) {
  return (
    <div className="ask-bar-dock">
      <div className="ask-pill">
        <button className="ask-pill-text" onClick={onType}>
          Ask me about people
        </button>
        <button className="ask-pill-mic" onClick={onVoice} aria-label="Ask by voice">
          <MicIcon size={20} />
        </button>
      </div>
      <button className="add-button" onClick={onAdd} aria-label="Add a person or moment">
        <AddPersonIcon />
      </button>
    </div>
  )
}
