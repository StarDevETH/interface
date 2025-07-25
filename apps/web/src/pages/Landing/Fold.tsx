import { Footer } from 'pages/Landing/sections/Footer'
import { forwardRef } from 'react'
import { Flex } from 'ui/src'

const Fold = forwardRef<HTMLDivElement>(function Fold(_props, scrollAnchor) {
  return (
    <Flex
      gap={120}
      $sm={{ gap: 80 }}
      position="relative"
      alignItems="center"
      width="100%"
      zIndex={1}
      maxWidth="100vw"
      ref={scrollAnchor}
    >
      {/*<DirectToDefi /> */}
      {/*<Stats /> */}
      {/*<NewsletterEtc />*/}
      <Footer />
    </Flex>
  )
})

export default Fold
