export default function StructuredData() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'SoftwareApplication',
    name: 'NovuraHealth',
    applicationCategory: 'HealthApplication',
    operatingSystem: 'Web',
    description: 'AI-powered GLP-1 medication companion app. Track injections, nutrition, weight, side effects, and get personalized coaching from Nova, your AI health coach.',
    url: 'https://novurahealth.com',
    offers: {
      '@type': 'Offer',
      price: '0',
      priceCurrency: 'USD',
      description: 'Free during beta',
    },
    featureList: [
      'AI health coach with personalized advice based on user data',
      'GLP-1 injection tracking with site rotation',
      'Nutrition logging with AI macro calculator',
      'Weight trend tracking and goal progress',
      'Side effect monitoring and pattern detection',
      'GLP-1 tapering and maintenance plan',
      'Weekly progress email digests',
    ],
    screenshot: 'https://novurahealth.com/og-image.png',
  }

  const orgJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: 'NovuraHealth',
    url: 'https://novurahealth.com',
    description: 'AI-powered GLP-1 medication companion helping users track, manage, and transition off GLP-1 medications.',
    contactPoint: {
      '@type': 'ContactPoint',
      email: 'support@novurahealth.com',
      contactType: 'customer support',
    },
  }

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(orgJsonLd) }} />
    </>
  )
}
