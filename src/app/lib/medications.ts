export type MedicationRoute = 'injection' | 'oral'
export type MedicationFrequency = 'weekly' | 'daily'
export type MedicationStatus = 'available' | 'coming_soon' | 'discontinued' | 'restricted'

export interface Medication {
  id: string
  brand_names: string[]
  generic_name: string
  manufacturer: string
  route: MedicationRoute
  frequency: MedicationFrequency
  available_doses: string[]
  half_life_hours: number
  absorption_tmax_hours: number
  fda_approved: boolean
  fda_approval_date?: string
  typical_weight_loss_pct: number
  mechanism: string
  cost_monthly_range: string
  notes?: string
  status: MedicationStatus
}

export const MEDICATIONS: Medication[] = [
  {
    id: 'semaglutide_injection',
    brand_names: ['Ozempic', 'Wegovy'],
    generic_name: 'Semaglutide',
    manufacturer: 'Novo Nordisk',
    route: 'injection',
    frequency: 'weekly',
    available_doses: ['0.25mg', '0.5mg', '1mg', '1.7mg', '2.4mg'],
    half_life_hours: 165,
    absorption_tmax_hours: 72,
    fda_approved: true,
    fda_approval_date: '2017-12-05',
    typical_weight_loss_pct: 14.9,
    mechanism: 'GLP-1',
    cost_monthly_range: '$900–1,200',
    status: 'available',
  },
  {
    id: 'tirzepatide_injection',
    brand_names: ['Mounjaro', 'Zepbound'],
    generic_name: 'Tirzepatide',
    manufacturer: 'Eli Lilly',
    route: 'injection',
    frequency: 'weekly',
    available_doses: ['2.5mg', '5mg', '7.5mg', '10mg', '12.5mg', '15mg'],
    half_life_hours: 120,
    absorption_tmax_hours: 48,
    fda_approved: true,
    fda_approval_date: '2022-05-13',
    typical_weight_loss_pct: 20.9,
    mechanism: 'GLP-1/GIP',
    cost_monthly_range: '$1,000–1,300',
    status: 'available',
  },
  {
    id: 'orforglipron_oral',
    brand_names: ['Foundayo'],
    generic_name: 'Orforglipron',
    manufacturer: 'Eli Lilly',
    route: 'oral',
    frequency: 'daily',
    available_doses: ['0.8mg', '2.5mg', '5.5mg', '9mg', '14.5mg', '17.2mg'],
    half_life_hours: 38,
    absorption_tmax_hours: 6,
    fda_approved: true,
    fda_approval_date: '2026-04-01',
    typical_weight_loss_pct: 12.4,
    mechanism: 'GLP-1',
    cost_monthly_range: '$149–399 self-pay',
    notes: 'First GLP-1 pill with no food or water timing restrictions. Take once daily at any time.',
    status: 'available',
  },
  {
    id: 'oral_semaglutide',
    brand_names: ['Rybelsus', 'Wegovy (pill)'],
    generic_name: 'Oral Semaglutide',
    manufacturer: 'Novo Nordisk',
    route: 'oral',
    frequency: 'daily',
    available_doses: ['3mg', '7mg', '14mg', '25mg'],
    half_life_hours: 165,
    absorption_tmax_hours: 1,
    fda_approved: true,
    fda_approval_date: '2025-12-20',
    typical_weight_loss_pct: 15.1,
    mechanism: 'GLP-1',
    cost_monthly_range: '$900–1,100',
    notes: 'Must be taken 30 minutes before first food/water of the day with no more than 4oz water.',
    status: 'available',
  },
  {
    id: 'liraglutide_injection',
    brand_names: ['Saxenda', 'Victoza'],
    generic_name: 'Liraglutide',
    manufacturer: 'Novo Nordisk',
    route: 'injection',
    frequency: 'daily',
    available_doses: ['0.6mg', '1.2mg', '1.8mg', '2.4mg', '3mg'],
    half_life_hours: 13,
    absorption_tmax_hours: 10,
    fda_approved: true,
    fda_approval_date: '2014-12-23',
    typical_weight_loss_pct: 8.0,
    mechanism: 'GLP-1',
    cost_monthly_range: '$1,300–1,500',
    notes: 'First-generation GLP-1. Now largely superseded by semaglutide and tirzepatide.',
    status: 'available',
  },
  {
    id: 'dulaglutide_injection',
    brand_names: ['Trulicity'],
    generic_name: 'Dulaglutide',
    manufacturer: 'Eli Lilly',
    route: 'injection',
    frequency: 'weekly',
    available_doses: ['0.75mg', '1.5mg', '3mg', '4.5mg'],
    half_life_hours: 120,
    absorption_tmax_hours: 48,
    fda_approved: true,
    fda_approval_date: '2014-09-18',
    typical_weight_loss_pct: 4.7,
    mechanism: 'GLP-1',
    cost_monthly_range: '$900–1,100',
    notes: 'Primarily for type 2 diabetes management. Modest weight loss compared to newer agents.',
    status: 'available',
  },
  {
    id: 'retatrutide_injection',
    brand_names: ['(no brand name yet)'],
    generic_name: 'Retatrutide',
    manufacturer: 'Eli Lilly',
    route: 'injection',
    frequency: 'weekly',
    available_doses: ['1mg', '2mg', '4mg', '8mg', '12mg'],
    half_life_hours: 144,
    absorption_tmax_hours: 48,
    fda_approved: false,
    typical_weight_loss_pct: 28.7,
    mechanism: 'GLP-1/GIP/glucagon',
    cost_monthly_range: 'Not yet available',
    notes: 'First triple-agonist obesity medication. Phase 3 TRIUMPH trials ongoing. Expected FDA approval late 2027 or early 2028. Currently only accessible through clinical trial enrollment.',
    status: 'coming_soon',
  },
  {
    id: 'compounded_semaglutide',
    brand_names: ['Compounded Semaglutide'],
    generic_name: 'Semaglutide (compounded)',
    manufacturer: 'Compounding pharmacy',
    route: 'injection',
    frequency: 'weekly',
    available_doses: ['0.25mg', '0.5mg', '1mg', '1.5mg', '2mg', '2.5mg', '3mg'],
    half_life_hours: 165,
    absorption_tmax_hours: 72,
    fda_approved: false,
    typical_weight_loss_pct: 14.9,
    mechanism: 'GLP-1',
    cost_monthly_range: '$150–400',
    notes: 'Tracking only — compounded versions are not FDA-permitted as of Feb 2025. Consult your provider about your medication source.',
    status: 'available',
  },
  {
    id: 'compounded_tirzepatide',
    brand_names: ['Compounded Tirzepatide'],
    generic_name: 'Tirzepatide (compounded)',
    manufacturer: 'Compounding pharmacy',
    route: 'injection',
    frequency: 'weekly',
    available_doses: ['2.5mg', '5mg', '7.5mg', '10mg', '12.5mg', '15mg'],
    half_life_hours: 120,
    absorption_tmax_hours: 48,
    fda_approved: false,
    typical_weight_loss_pct: 20.9,
    mechanism: 'GLP-1/GIP',
    cost_monthly_range: '$200–500',
    notes: 'Tracking only — compounded tirzepatide is available under FDA shortage provisions. Consult your provider.',
    status: 'available',
  },
  {
    id: 'retatrutide_research',
    brand_names: ['Retatrutide (research/trial)'],
    generic_name: 'Retatrutide',
    manufacturer: 'Eli Lilly (clinical trial) / research peptide',
    route: 'injection',
    frequency: 'weekly',
    available_doses: ['1mg', '2mg', '4mg', '8mg', '12mg'],
    half_life_hours: 144,
    absorption_tmax_hours: 48,
    fda_approved: false,
    typical_weight_loss_pct: 28.7,
    mechanism: 'GLP-1/GIP/glucagon',
    cost_monthly_range: 'Varies',
    notes: 'Not FDA approved. Tracking only — typically used by clinical trial participants or research peptide users.',
    status: 'available',
  },
]

/** Find a medication by its ID */
export function getMedication(id: string): Medication | undefined {
  return MEDICATIONS.find(m => m.id === id)
}

/** All medications that users can actively select (available status) */
export function getAvailableMedications(): Medication[] {
  return MEDICATIONS.filter(m => m.status === 'available')
}

/** Coming soon medications (educational only) */
export function getComingSoonMedications(): Medication[] {
  return MEDICATIONS.filter(m => m.status === 'coming_soon')
}

/** Restricted medications (need warning) */
export function getRestrictedMedications(): Medication[] {
  return MEDICATIONS.filter(m => m.status === 'restricted')
}

/**
 * Resolve a user-facing medication label (e.g. "Ozempic", "Mounjaro") to
 * the canonical Medication record. Matches against brand_names.
 */
export function findMedicationByLabel(label: string): Medication | undefined {
  const lower = label.toLowerCase().trim()
  return MEDICATIONS.find(m =>
    m.brand_names.some(b => b.toLowerCase() === lower) ||
    m.generic_name.toLowerCase() === lower ||
    m.id === lower
  )
}

/**
 * Get dose options for a brand name. Returns numeric strings without "mg".
 * Used by onboarding/settings to populate dose picker.
 */
export function getDosesForBrand(brandOrLabel: string): string[] {
  const med = findMedicationByLabel(brandOrLabel)
  if (!med) return []
  return med.available_doses.map(d => d.replace('mg', ''))
}

/**
 * PK lookup for chart — returns the values MedicationLevelChart needs.
 * Maps from user-facing brand names to PK parameters.
 */
export function getPKProfile(brandOrLabel: string) {
  const med = findMedicationByLabel(brandOrLabel)
  if (!med) return null
  return {
    name: `${med.generic_name} (${med.brand_names[0]})`,
    halfLifeHours: med.half_life_hours,
    absorptionTmaxHours: med.absorption_tmax_hours,
    dosingIntervalHours: med.frequency === 'weekly' ? 168 : 24,
    mechanism: med.mechanism,
    source: med.fda_approved
      ? `FDA ${med.brand_names[0]} label`
      : med.notes || 'Estimated',
  }
}

/**
 * Build the onboarding/settings medication list with display info.
 */
export function getMedicationChoices() {
  const available = getAvailableMedications()
  const comingSoon = getComingSoonMedications()
  const restricted = getRestrictedMedications()

  const sixMonthsAgo = new Date()
  sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6)

  return {
    available: available.map(m => ({
      id: m.id,
      label: m.brand_names[0],
      sub: m.generic_name.toLowerCase(),
      route: m.route,
      frequency: m.frequency,
      mechanism: m.mechanism,
      doses: m.available_doses.map(d => d.replace('mg', '')),
      isNew: m.fda_approval_date ? new Date(m.fda_approval_date) > sixMonthsAgo : false,
      notes: m.notes,
    })),
    comingSoon: comingSoon.map(m => ({
      id: m.id,
      label: m.generic_name,
      mechanism: m.mechanism,
      weightLossPct: m.typical_weight_loss_pct,
      notes: m.notes,
    })),
    restricted: restricted.map(m => ({
      id: m.id,
      label: m.brand_names[0],
      notes: m.notes,
    })),
  }
}
