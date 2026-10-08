import { useRecordMutation } from '../query/hooks';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { saveContent } from '../api';
import type { Content, CreateContentInput } from '../types';
import { useNotifications } from '../context/NotificationContext';
interface Props {
  content: Content | null;
  onSaved: () => void;
  onCancel: () => void;
}
export function ContentForm({ content, onSaved, onCancel }: Props) {
  const { notify } = useNotifications();
  const saveMutation = useRecordMutation(
    'content',
    ({ input, signal }: { input: CreateContentInput; signal: AbortSignal }) =>
      saveContent(content?.id ?? null, input, signal),
  );
  const [form, setForm] = useState<CreateContentInput>({
    title: content?.title ?? '',
    slug: content?.slug ?? '',
    summary: content?.summary ?? '',
    body: content?.body ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const controller = new AbortController();
    request.current = controller;
    setBusy(true);
    setError('');
    try {
      await saveMutation.mutateAsync({
        input: form,
        signal: controller.signal,
      });
      if (!controller.signal.aborted) {
        notify('success', content ? 'Content updated' : 'Content created');
        onSaved();
      }
    } catch (failure) {
      if (!controller.signal.aborted) {
        const message =
          failure instanceof Error ? failure.message : 'Unable to save content';
        setError(message);
        notify('error', message);
      }
    } finally {
      if (!controller.signal.aborted) setBusy(false);
    }
  }
  return (
    <section>
      <h2>{content ? 'Edit content' : 'Create content'}</h2>
      <form onSubmit={(event) => void submit(event)}>
        <fieldset disabled={busy}>
          <label>
            Title
            <input
              required
              maxLength={200}
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
          </label>
          <label>
            Slug
            <input
              required
              maxLength={200}
              pattern="[a-z0-9]+(-[a-z0-9]+)*"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
            />
          </label>
          <label>
            Summary
            <textarea
              maxLength={5000}
              value={form.summary ?? ''}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
            />
          </label>
          <label>
            Body
            <textarea
              required
              rows={12}
              maxLength={50000}
              value={form.body}
              onChange={(e) => setForm({ ...form, body: e.target.value })}
            />
          </label>
          {error && (
            <p role="alert" className="failure">
              {error}
            </p>
          )}
          <div className="actions">
            <button type="submit">{busy ? 'Saving…' : 'Save content'}</button>
            <button type="button" className="secondary" onClick={onCancel}>
              Cancel
            </button>
          </div>
        </fieldset>
      </form>
    </section>
  );
}
