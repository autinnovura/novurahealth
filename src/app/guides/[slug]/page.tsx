import { Metadata } from 'next'
import { createClient } from '@supabase/supabase-js'
import { notFound } from 'next/navigation'
import Link from 'next/link'

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
)

function slugify(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
}

interface KnowledgeEntry {
  id: string
  topic: string
  question: string
  answer: string
  related_medications: string[] | null
  display_order: number
}

export async function generateStaticParams() {
  const { data } = await supabaseAdmin
    .from('glp1_knowledge')
    .select('topic')
    .eq('is_published', true)

  if (!data) return []

  const topics = [...new Set(data.map(k => k.topic))]
  return topics.map(topic => ({ slug: slugify(topic) }))
}

export async function generateMetadata(
  { params }: { params: Promise<{ slug: string }> }
): Promise<Metadata> {
  const { slug } = await params
  const { data } = await supabaseAdmin
    .from('glp1_knowledge')
    .select('topic, question, answer')
    .eq('is_published', true)

  if (!data?.length) return { title: 'Guide | NovuraHealth' }

  const entries = data.filter(k => slugify(k.topic) === slug)
  if (!entries.length) return { title: 'Guide | NovuraHealth' }

  const topic = entries[0].topic
  const firstAnswer = entries[0].answer.slice(0, 155)

  return {
    title: `${topic} — GLP-1 Guide | NovuraHealth`,
    description: `${firstAnswer}...`,
    keywords: [
      topic.toLowerCase(),
      'GLP-1', 'semaglutide', 'tirzepatide',
      'weight loss medication', 'NovuraHealth guide',
    ],
    openGraph: {
      title: `${topic} — GLP-1 Guide`,
      description: firstAnswer,
      url: `https://novurahealth.com/guides/${slug}`,
    },
  }
}

export default async function GuidePage(
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const { data } = await supabaseAdmin
    .from('glp1_knowledge')
    .select('*')
    .eq('is_published', true)
    .order('display_order')

  if (!data?.length) notFound()

  const entries: KnowledgeEntry[] = data.filter(k => slugify(k.topic) === slug)
  if (!entries.length) notFound()

  const topic = entries[0].topic

  // Get all topics for sidebar navigation
  const allTopics = [...new Set(data.map(k => k.topic))]

  return (
    <div className="min-h-screen bg-[#FAFAF7]" style={{ fontFamily: 'var(--font-inter)' }}>
      {/* Hero */}
      <header className="bg-gradient-to-br from-[#1F4B32] via-[#2D6B45] to-[#1F4B32] px-5 py-12">
        <div className="max-w-3xl mx-auto text-center">
          <Link href="/guides/glp1-medications-2026" className="text-[#7FFFA4] text-xs font-semibold uppercase tracking-wider mb-3 inline-block hover:underline">
            NovuraHealth Guides
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold text-white leading-tight mt-2" style={{ fontFamily: 'var(--font-fraunces)' }}>
            {topic}
          </h1>
          <p className="text-white/40 text-xs mt-3">GLP-1 Knowledge Base</p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-5 py-8">
        {/* Breadcrumb */}
        <nav className="text-xs text-[#6B7A72] mb-6">
          <Link href="/" className="hover:text-[#1F4B32]">Home</Link>
          <span className="mx-2">/</span>
          <Link href="/guides/glp1-medications-2026" className="hover:text-[#1F4B32]">Guides</Link>
          <span className="mx-2">/</span>
          <span className="text-[#0D1F16]">{topic}</span>
        </nav>

        {/* Q&A entries */}
        <div className="space-y-6">
          {entries.map((entry) => (
            <article key={entry.id} className="bg-white border border-[#EAF2EB] rounded-3xl p-6 shadow-[0_4px_24px_-8px_rgba(31,75,50,0.08)]">
              <h2 className="text-lg font-semibold text-[#0D1F16] mb-3" style={{ fontFamily: 'var(--font-fraunces)' }}>
                {entry.question}
              </h2>
              <div className="text-sm text-[#0D1F16]/80 leading-relaxed whitespace-pre-wrap">
                {entry.answer}
              </div>
              {entry.related_medications && entry.related_medications.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {entry.related_medications.map(med => (
                    <span key={med} className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-[#EAF2EB] text-[#1F4B32]">
                      {med.replace(/_/g, ' ')}
                    </span>
                  ))}
                </div>
              )}
            </article>
          ))}
        </div>

        {/* Related topics */}
        {allTopics.length > 1 && (
          <div className="mt-10">
            <h3 className="text-sm font-semibold text-[#0D1F16] mb-3">More GLP-1 Guides</h3>
            <div className="flex flex-wrap gap-2">
              {allTopics.filter(t => t !== topic).map(t => (
                <Link key={t} href={`/guides/${slugify(t)}`}
                  className="text-xs px-4 py-2 rounded-full border border-[#EAF2EB] text-[#6B7A72] hover:border-[#1F4B32] hover:text-[#1F4B32] transition-all">
                  {t}
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* CTA */}
        <div className="mt-10 bg-gradient-to-br from-[#EAF2EB] to-[#F5F8F3] rounded-3xl p-6 text-center">
          <h3 className="text-base font-semibold text-[#0D1F16] mb-2" style={{ fontFamily: 'var(--font-fraunces)' }}>
            Track your GLP-1 journey
          </h3>
          <p className="text-sm text-[#6B7A72] mb-4">
            NovuraHealth helps you log medications, track side effects, hit protein targets, and plan your transition off GLP-1s.
          </p>
          <Link href="/signup"
            className="inline-block bg-gradient-to-r from-[#1F4B32] to-[#2D6B45] text-white px-6 py-3 rounded-2xl text-sm font-semibold hover:shadow-[0_4px_16px_-4px_rgba(31,75,50,0.4)] transition-all">
            Get Started Free
          </Link>
        </div>
      </div>
    </div>
  )
}
