import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Link, Preview, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface WelcomeEmailProps {
  fullName?: string
  farmName?: string
  signInUrl?: string
}

const SITE = 'PoultryPro™'
const DEFAULT_SIGNIN = 'https://poultrypro.life/auth'

const WelcomeEmail = ({
  fullName = 'there',
  farmName = 'your farm',
  signInUrl = DEFAULT_SIGNIN,
}: WelcomeEmailProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to {SITE} — your farm dashboard is ready</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>Welcome to {SITE}, {fullName}</Heading>
        <Text style={text}>
          Your account for <strong>{farmName}</strong> has been created successfully. You now have
          access to a complete platform for tracking egg production, feed usage, mortality, health
          records, and AI-driven farm intelligence.
        </Text>

        <Section style={{ margin: '28px 0' }}>
          <Heading as="h2" style={h2}>Your next steps</Heading>
          <Text style={text}>1. Set up your rooms and starting bird counts.</Text>
          <Text style={text}>2. Log your first daily production and feed usage.</Text>
          <Text style={text}>3. Review your AI Intelligence panel for early insights.</Text>
        </Section>

        <Button style={button} href={signInUrl}>Sign in to your dashboard</Button>

        <Hr style={hr} />
        <Text style={footer}>
          Questions? Reply to this email and our team will assist you. — Team {SITE}
        </Text>
        <Text style={footer}>
          <Link href="https://poultrypro.life" style={link}>poultrypro.life</Link>
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeEmail,
  subject: 'Welcome to PoultryPro™',
  displayName: 'Welcome — New User',
  previewData: { fullName: 'Abubakar Sadiq', farmName: 'Greenfield Contracts & Agro Limited', signInUrl: DEFAULT_SIGNIN },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '28px 32px', maxWidth: '560px' }
const h1 = { fontSize: '24px', fontWeight: 700 as const, color: '#0f172a', margin: '0 0 16px' }
const h2 = { fontSize: '16px', fontWeight: 600 as const, color: '#0f172a', margin: '0 0 12px' }
const text = { fontSize: '14px', color: '#334155', lineHeight: '1.6', margin: '0 0 12px' }
const link = { color: '#0f766e', textDecoration: 'underline' }
const button = {
  backgroundColor: '#0f766e', color: '#ffffff', fontSize: '14px', fontWeight: 600 as const,
  borderRadius: '10px', padding: '12px 22px', textDecoration: 'none',
}
const hr = { borderColor: '#e2e8f0', margin: '28px 0' }
const footer = { fontSize: '12px', color: '#94a3b8', margin: '6px 0' }
