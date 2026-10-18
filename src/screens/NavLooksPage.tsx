import { navLayouts, type NavLayout } from '../lib/navLayouts'
import { Prototype } from '../Prototype'
import { LooksPage } from './LooksPage'

export function NavLooksPage() {
  return (
    <LooksPage
      title="Nav bar layouts with Ask"
      intro="Each phone is the real app. The mic in the middle opens Ask, the voice AI search: tap it to hear an example, or type your own request."
      options={navLayouts}
      param="nav"
      render={(id) => <Prototype navLayout={id as NavLayout} />}
    />
  )
}
