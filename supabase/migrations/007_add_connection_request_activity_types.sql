-- Allow connection request events in activities.

ALTER TABLE activities
  DROP CONSTRAINT IF EXISTS activities_type_check;

ALTER TABLE activities
  ADD CONSTRAINT activities_type_check
  CHECK (
    type IN (
      'email_sent', 'email_received',
      'connection_request_sent', 'connection_request_accepted',
      'linkedin_sent', 'linkedin_received',
      'call',
      'text_sent', 'text_received',
      'note'
    )
  );
