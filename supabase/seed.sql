-- Seed Data: 10 realistic B2B leads with conversation threads

-- Lead 1: Alexandra Anholt
INSERT INTO leads (id, first_name, last_name, email, phone, title, company, linkedin_url, company_website, stage, source, campaign_name, created_at, updated_at, last_activity)
VALUES (
  'a1000000-0000-0000-0000-000000000001',
  'Alexandra', 'Anholt',
  'alexandra@novabiotech.com', '+1-415-555-0101',
  'Head of Marketing', 'Nova Biotech',
  'https://linkedin.com/in/alexandraanholt', 'https://novabiotech.com',
  'lead_feed', 'getsales_webhook', 'Q1 Biotech Outreach',
  NOW() - INTERVAL '3 days', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours'
);

INSERT INTO messages (lead_id, channel, direction, content, is_note, timestamp) VALUES
('a1000000-0000-0000-0000-000000000001', 'linkedin', 'outbound', 'Hi Alexandra, I came across your profile and was impressed by the work Nova Biotech is doing in the personalized medicine space. I help biotech companies streamline their go-to-market strategy — would love to share some ideas that might be relevant to your team.', false, NOW() - INTERVAL '3 days'),
('a1000000-0000-0000-0000-000000000001', 'linkedin', 'inbound', 'Hey! Thanks for reaching out. We are actually looking at revamping our outbound strategy this quarter. What did you have in mind?', false, NOW() - INTERVAL '2 days'),
('a1000000-0000-0000-0000-000000000001', 'linkedin', 'outbound', 'Great to hear! We have helped similar biotech companies increase their qualified pipeline by 3x using targeted multi-channel outreach. Would you be open to a quick 15-min call this week to explore if there is a fit?', false, NOW() - INTERVAL '2 hours');

-- Lead 2: Marcus Chen
INSERT INTO leads (id, first_name, last_name, email, phone, title, company, linkedin_url, company_website, stage, source, campaign_name, created_at, updated_at, last_activity)
VALUES (
  'a1000000-0000-0000-0000-000000000002',
  'Marcus', 'Chen',
  'marcus.chen@velocitysaas.io', '+1-650-555-0102',
  'VP of Sales', 'Velocity SaaS',
  'https://linkedin.com/in/marcuschen', 'https://velocitysaas.io',
  'lead_feed', 'getsales_webhook', 'SaaS Leaders Campaign',
  NOW() - INTERVAL '5 days', NOW() - INTERVAL '1 day', NOW() - INTERVAL '1 day'
);

INSERT INTO messages (lead_id, channel, direction, content, is_note, timestamp) VALUES
('a1000000-0000-0000-0000-000000000002', 'linkedin', 'outbound', 'Marcus, congrats on the Series B! I saw Velocity SaaS just closed a big round. We work with high-growth SaaS companies to help scale their outbound sales engine. Would love to connect.', false, NOW() - INTERVAL '5 days'),
('a1000000-0000-0000-0000-000000000002', 'linkedin', 'inbound', 'Thanks! It has been an exciting time. We are indeed scaling the sales team rapidly. What does your solution look like?', false, NOW() - INTERVAL '3 days'),
('a1000000-0000-0000-0000-000000000002', 'linkedin', 'outbound', 'We provide an AI-powered outbound platform that automates personalized outreach across LinkedIn, email, and phone. Our clients typically see 40% higher response rates. Happy to show you a quick demo?', false, NOW() - INTERVAL '2 days'),
('a1000000-0000-0000-0000-000000000002', 'linkedin', 'inbound', 'That sounds interesting. Let me loop in our Head of Revenue Ops. Can you send over some case studies first?', false, NOW() - INTERVAL '1 day');

-- Lead 3: Priya Sharma
INSERT INTO leads (id, first_name, last_name, email, phone, title, company, linkedin_url, company_website, stage, source, campaign_name, created_at, updated_at, last_activity)
VALUES (
  'a1000000-0000-0000-0000-000000000003',
  'Priya', 'Sharma',
  'priya@cloudmatrix.dev', '+1-212-555-0103',
  'Director of Growth', 'CloudMatrix',
  'https://linkedin.com/in/priyasharma-growth', 'https://cloudmatrix.dev',
  'lead_feed', 'getsales_webhook', 'DevTools Outreach',
  NOW() - INTERVAL '1 day', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '4 hours'
);

INSERT INTO messages (lead_id, channel, direction, content, is_note, timestamp) VALUES
('a1000000-0000-0000-0000-000000000003', 'linkedin', 'outbound', 'Hi Priya, I noticed CloudMatrix just launched your new developer platform. Impressive product! We help DevTools companies like yours build predictable outbound pipelines. Mind if I share how?', false, NOW() - INTERVAL '1 day'),
('a1000000-0000-0000-0000-000000000003', 'linkedin', 'inbound', 'Hi! Yes, we are actively looking for ways to improve our outbound. Our current approach is mostly inbound-driven and we need to diversify. Tell me more!', false, NOW() - INTERVAL '4 hours');

-- Lead 4: James O'Brien
INSERT INTO leads (id, first_name, last_name, email, phone, title, company, linkedin_url, company_website, stage, source, campaign_name, created_at, updated_at, last_activity)
VALUES (
  'a1000000-0000-0000-0000-000000000004',
  'James', 'O''Brien',
  'jobrien@fintech-global.com', '+1-312-555-0104',
  'Chief Revenue Officer', 'FinTech Global',
  'https://linkedin.com/in/jamesobrien-cro', 'https://fintech-global.com',
  'meeting_booked', 'getsales_webhook', 'FinTech Leaders Q1',
  NOW() - INTERVAL '10 days', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours'
);

INSERT INTO messages (lead_id, channel, direction, content, is_note, timestamp) VALUES
('a1000000-0000-0000-0000-000000000004', 'linkedin', 'outbound', 'James, your track record scaling revenue teams at FinTech Global is impressive. We have been helping similar fintech companies build more efficient outbound motions. Would love to exchange ideas.', false, NOW() - INTERVAL '10 days'),
('a1000000-0000-0000-0000-000000000004', 'linkedin', 'inbound', 'Appreciate the kind words! Always open to learning about new approaches. What makes your solution different?', false, NOW() - INTERVAL '8 days'),
('a1000000-0000-0000-0000-000000000004', 'linkedin', 'outbound', 'Great question. Unlike traditional tools, we combine AI personalization with multi-channel sequencing. One of our fintech clients went from 2% to 12% reply rates. Want to hop on a quick call?', false, NOW() - INTERVAL '6 days'),
('a1000000-0000-0000-0000-000000000004', 'linkedin', 'inbound', 'Those numbers are compelling. Yes, let us set up a call. How about Thursday at 2pm ET?', false, NOW() - INTERVAL '4 days'),
('a1000000-0000-0000-0000-000000000004', 'linkedin', 'outbound', 'Perfect! I will send over a calendar invite. Looking forward to it, James.', false, NOW() - INTERVAL '4 days'),
('a1000000-0000-0000-0000-000000000004', 'linkedin', 'outbound', 'Stage changed to Meeting Booked', true, NOW() - INTERVAL '4 days');

-- Lead 5: Sarah Kim
INSERT INTO leads (id, first_name, last_name, email, phone, title, company, linkedin_url, company_website, stage, source, campaign_name, created_at, updated_at, last_activity)
VALUES (
  'a1000000-0000-0000-0000-000000000005',
  'Sarah', 'Kim',
  'sarah.kim@datapulse.ai', '+1-408-555-0105',
  'Head of Sales Development', 'DataPulse AI',
  'https://linkedin.com/in/sarahkim-sdr', 'https://datapulse.ai',
  'lead_feed', 'getsales_webhook', 'AI Companies Campaign',
  NOW() - INTERVAL '7 days', NOW() - INTERVAL '12 hours', NOW() - INTERVAL '12 hours'
);

INSERT INTO messages (lead_id, channel, direction, content, is_note, timestamp) VALUES
('a1000000-0000-0000-0000-000000000005', 'email', 'outbound', 'Hi Sarah, I saw DataPulse AI is hiring aggressively for SDRs. Before you scale the team, have you considered how AI-assisted outbound could help your existing reps do 3x the work? Would love to chat about it.', false, NOW() - INTERVAL '7 days'),
('a1000000-0000-0000-0000-000000000005', 'email', 'inbound', 'Interesting timing — we were just discussing this in our leadership meeting. Can you share more details about your platform?', false, NOW() - INTERVAL '5 days'),
('a1000000-0000-0000-0000-000000000005', 'email', 'outbound', 'Absolutely! Here is a brief overview: [link to deck]. The key differentiator is our AI writes personalized first lines based on prospect research, and sequences across LinkedIn + email simultaneously. Happy to walk you through a live demo.', false, NOW() - INTERVAL '3 days'),
('a1000000-0000-0000-0000-000000000005', 'email', 'inbound', 'The deck looks great. Let me review with my VP and get back to you by end of week.', false, NOW() - INTERVAL '12 hours');

-- Lead 6: Daniel Torres
INSERT INTO leads (id, first_name, last_name, email, phone, title, company, linkedin_url, company_website, stage, source, campaign_name, created_at, updated_at, last_activity)
VALUES (
  'a1000000-0000-0000-0000-000000000006',
  'Daniel', 'Torres',
  'dtorres@greenshift.io', '+1-305-555-0106',
  'Co-Founder & CEO', 'GreenShift Energy',
  'https://linkedin.com/in/danieltorres-ceo', 'https://greenshift.io',
  'snoozed', 'getsales_webhook', 'CleanTech Founders',
  NOW() - INTERVAL '14 days', NOW() - INTERVAL '2 days', NOW() - INTERVAL '2 days'
);

UPDATE leads SET snoozed_until = NOW() + INTERVAL '3 days' WHERE id = 'a1000000-0000-0000-0000-000000000006';

INSERT INTO messages (lead_id, channel, direction, content, is_note, timestamp) VALUES
('a1000000-0000-0000-0000-000000000006', 'linkedin', 'outbound', 'Daniel, love what GreenShift is doing in the clean energy space. We help climate tech startups build outbound sales engines. Would you be open to a conversation?', false, NOW() - INTERVAL '14 days'),
('a1000000-0000-0000-0000-000000000006', 'linkedin', 'inbound', 'Thanks for reaching out! We are in the middle of a fundraise right now so timing is tight. Can you circle back in a couple weeks?', false, NOW() - INTERVAL '10 days'),
('a1000000-0000-0000-0000-000000000006', 'linkedin', 'outbound', 'Totally understand! I will follow up after your raise. Best of luck with the fundraise, Daniel!', false, NOW() - INTERVAL '10 days'),
('a1000000-0000-0000-0000-000000000006', 'linkedin', 'outbound', 'Snoozed — following up after fundraise closes', true, NOW() - INTERVAL '2 days');

-- Lead 7: Emily Watson
INSERT INTO leads (id, first_name, last_name, email, phone, title, company, linkedin_url, company_website, stage, source, campaign_name, created_at, updated_at, last_activity)
VALUES (
  'a1000000-0000-0000-0000-000000000007',
  'Emily', 'Watson',
  'emily.watson@healthbridge.co', '+1-617-555-0107',
  'VP of Business Development', 'HealthBridge',
  'https://linkedin.com/in/emilywatson-bd', 'https://healthbridge.co',
  'closed_won', 'getsales_webhook', 'HealthTech Outreach',
  NOW() - INTERVAL '30 days', NOW() - INTERVAL '3 days', NOW() - INTERVAL '3 days'
);

INSERT INTO messages (lead_id, channel, direction, content, is_note, timestamp) VALUES
('a1000000-0000-0000-0000-000000000007', 'linkedin', 'outbound', 'Emily, HealthBridge is doing incredible work connecting patients with clinical trials. We specialize in helping health tech companies build scalable outbound pipelines. Would love to explore synergies.', false, NOW() - INTERVAL '30 days'),
('a1000000-0000-0000-0000-000000000007', 'linkedin', 'inbound', 'Thanks! We have been struggling with outbound actually. Our inbound is strong but we need to proactively reach hospital networks. Tell me more.', false, NOW() - INTERVAL '28 days'),
('a1000000-0000-0000-0000-000000000007', 'email', 'outbound', 'Great to hear there is interest! I put together a quick proposal based on what I know about HealthBridge. See attached. The key is our multi-channel approach targeting hospital procurement officers.', false, NOW() - INTERVAL '20 days'),
('a1000000-0000-0000-0000-000000000007', 'email', 'inbound', 'This looks really thorough. We would like to move forward. Can you send over the contract?', false, NOW() - INTERVAL '10 days'),
('a1000000-0000-0000-0000-000000000007', 'email', 'outbound', 'Amazing! Sending the contract now. Welcome aboard, Emily! 🎉', false, NOW() - INTERVAL '5 days'),
('a1000000-0000-0000-0000-000000000007', 'email', 'outbound', 'Contract signed! Closed Won 🎉', true, NOW() - INTERVAL '3 days');

-- Lead 8: Ryan Patel
INSERT INTO leads (id, first_name, last_name, email, phone, title, company, linkedin_url, company_website, stage, source, campaign_name, created_at, updated_at, last_activity)
VALUES (
  'a1000000-0000-0000-0000-000000000008',
  'Ryan', 'Patel',
  'ryan@logisticsplus.com', '+1-713-555-0108',
  'Director of Partnerships', 'Logistics Plus',
  'https://linkedin.com/in/ryanpatel-partnerships', 'https://logisticsplus.com',
  'closed_lost', 'getsales_webhook', 'Logistics & Supply Chain',
  NOW() - INTERVAL '21 days', NOW() - INTERVAL '5 days', NOW() - INTERVAL '5 days'
);

INSERT INTO messages (lead_id, channel, direction, content, is_note, timestamp) VALUES
('a1000000-0000-0000-0000-000000000008', 'linkedin', 'outbound', 'Ryan, noticed Logistics Plus is expanding into last-mile delivery. We help logistics companies generate qualified leads through targeted outbound campaigns. Mind if I share some results?', false, NOW() - INTERVAL '21 days'),
('a1000000-0000-0000-0000-000000000008', 'linkedin', 'inbound', 'Sure, send over what you have. We are always evaluating new lead gen channels.', false, NOW() - INTERVAL '18 days'),
('a1000000-0000-0000-0000-000000000008', 'email', 'outbound', 'Here is a case study from a similar logistics company that saw 5x ROI on their outbound investment: [link]. Would a 20-min call make sense to discuss?', false, NOW() - INTERVAL '14 days'),
('a1000000-0000-0000-0000-000000000008', 'email', 'inbound', 'Appreciate the follow-up. Unfortunately, we just signed a 12-month contract with another vendor for this. Maybe next year?', false, NOW() - INTERVAL '7 days'),
('a1000000-0000-0000-0000-000000000008', 'email', 'outbound', 'No worries at all, Ryan. I will set a reminder to reconnect when your contract is up. Best of luck!', false, NOW() - INTERVAL '5 days'),
('a1000000-0000-0000-0000-000000000008', 'email', 'outbound', 'Lost — went with competitor. Revisit in 12 months.', true, NOW() - INTERVAL '5 days');

-- Lead 9: Lisa Nakamura
INSERT INTO leads (id, first_name, last_name, email, phone, title, company, linkedin_url, company_website, stage, source, campaign_name, created_at, updated_at, last_activity)
VALUES (
  'a1000000-0000-0000-0000-000000000009',
  'Lisa', 'Nakamura',
  'lisa@eduvance.com', '+1-206-555-0109',
  'Chief Marketing Officer', 'Eduvance',
  'https://linkedin.com/in/lisanakamura-cmo', 'https://eduvance.com',
  'lead_feed', 'getsales_webhook', 'EdTech Decision Makers',
  NOW() - INTERVAL '2 days', NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours'
);

INSERT INTO messages (lead_id, channel, direction, content, is_note, timestamp) VALUES
('a1000000-0000-0000-0000-000000000009', 'linkedin', 'outbound', 'Lisa, Eduvance is transforming online education — really impressive growth trajectory. We help EdTech companies like yours accelerate B2B sales through intelligent outbound. Open to a quick chat?', false, NOW() - INTERVAL '2 days'),
('a1000000-0000-0000-0000-000000000009', 'linkedin', 'inbound', 'Hi! Yes, actually perfect timing. We just hired 3 new AEs and need to ramp up their pipeline fast. What do you recommend?', false, NOW() - INTERVAL '6 hours');

-- Lead 10: Michael Okafor
INSERT INTO leads (id, first_name, last_name, email, phone, title, company, linkedin_url, company_website, stage, source, campaign_name, created_at, updated_at, last_activity)
VALUES (
  'a1000000-0000-0000-0000-000000000010',
  'Michael', 'Okafor',
  'michael@paystream.io', '+1-404-555-0110',
  'Head of Growth', 'PayStream',
  'https://linkedin.com/in/michaelokafor', 'https://paystream.io',
  'lead_feed', 'getsales_webhook', 'FinTech Leaders Q1',
  NOW() - INTERVAL '1 day', NOW() - INTERVAL '30 minutes', NOW() - INTERVAL '30 minutes'
);

INSERT INTO messages (lead_id, channel, direction, content, is_note, timestamp) VALUES
('a1000000-0000-0000-0000-000000000010', 'linkedin', 'outbound', 'Michael, PayStream is payment infrastructure is getting a lot of buzz in the fintech community. We help companies like yours build predictable outbound revenue engines. Would love to connect!', false, NOW() - INTERVAL '1 day'),
('a1000000-0000-0000-0000-000000000010', 'linkedin', 'inbound', 'Hey, appreciate you reaching out! We have actually been underinvesting in outbound. What kind of results are your fintech clients seeing?', false, NOW() - INTERVAL '30 minutes');
