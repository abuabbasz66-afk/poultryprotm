import * as React from 'react'
import {
  Body, Button, Container, Head, Heading, Hr, Html, Preview, Row, Column, Section, Text,
} from '@react-email/components'
import type { TemplateEntry } from './registry'

interface AdminNewAccountProps {
  fullName?: string
  farmName?: string
  email?: string
  phone?: string
  country?: string
  state?: string
  subscriptionPlan?: string
  userId?: string
  farmId?: string
  registeredAt?: string
  adminUrl?: string
}

const DEFAULT_ADMIN = 'https://poultrypro.life/super-admin'

const Field = ({ label, value }: { label: string; value?: string }) => (
  <Row style={{ marginBottom: 6 }}>
    <Column style={{ width: 140, color: '#64748b', fontSize: 13 }}>{label}</Column>
    <Column style={{ color: '#0f172a', fontSize: 13, fontWeight: 500 }}>{value || '—'}</Column>
  </Row>
)

const AdminNewAccountEmail = ({
  fullName, farmName, email, phone, country, state,
  subscriptionPlan = 'basic', userId, farmId, registeredAt,
  adminUrl = DEFAULT_ADMIN,
}: AdminNewAccountProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New PoultryPro account: {fullName || email || 'a new user'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Heading style={h1}>New account registered</Heading>
        <Text style={text}>
          A new user has successfully created a PoultryPro™ account. Full details below.
        </Text>

        <Section style={card}>
          <Field label="Full Name" value={fullName} />
          <Field label="Farm Name" value={farmName} />
          <Field label="Email" value={email} />
          <Field label="Phone" value={phone} />
          <Field label="Country" value={country} />
          <Field label="State / Region" value={state} />
          <Field label="Subscription Plan" value={subscriptionPlan} />
          <Field label="Registered At" value={registeredAt} />
          <Hr style={hr} />
          <Field label="User ID" value={userId} />
          <Field label="Farm ID" value={farmId} />
        </Section>

        <Button style={button} href={adminUrl}>Open in Super Admin</Button>

        <Text style={footer}>Automated notification from the PoultryPro™ platform.</Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AdminNewAccountEmail,
  subject: 'New PoultryPro™ account registered',
  displayName: 'Admin — New account registered',
  previewData: {
    fullName: 'Abubakar Sadiq Abbas',
    farmName: 'Greenfield Contracts & Agro Limited',
    email: 'abubakar@example.com',
    phone: '+234 800 000 0000',
    country: 'Nigeria',
    state: 'Kano',
    subscriptionPlan: 'basic',
    userId: '00000000-0000-0000-0000-000000000000',
    farmId: '00000000-0000-0000-0000-000000000000',
    registeredAt: '16 July 2026, 14:35',
    adminUrl: DEFAULT_ADMIN,
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '28px 32px', maxWidth: '600px' }
const h1 = { fontSize: '22px', fontWeight: 700 as const, color: '#0f172a', margin: '0 0 12px' }
const text = { fontSize: '14px', color: '#334155', lineHeight: '1.6', margin: '0 0 20px' }
const card = {
  backgroundColor: '#f8fafc', border: '1px solid #e2e8f0',
  borderRadius: '12px', padding: '18px 20px', margin: '0 0 24px',
}
const hr = { borderColor: '#e2e8f0', margin: '14px 0' }
const button = {
  backgroundColor: '#0f172a', color: '#ffffff', fontSize: '14px', fontWeight: 600 as const,
  borderRadius: '10px', padding: '12px 22px', textDecoration: 'none',
}
const footer = { fontSize: '12px', color: '#94a3b8', margin: '24px 0 0' }
