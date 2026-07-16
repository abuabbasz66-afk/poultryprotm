import type { ComponentType } from 'react'
import { template as welcomeTemplate } from './welcome'
import { template as adminNewAccountTemplate } from './admin-new-account'

export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

export const TEMPLATES: Record<string, TemplateEntry> = {
  welcome: welcomeTemplate,
  'admin-new-account': adminNewAccountTemplate,
}
