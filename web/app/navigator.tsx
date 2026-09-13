/* oxlint-disable next/no-html-link-for-pages -- Platform sign-in/out require top-level native navigation; view navigation preserves shareable query URLs. */
/* oxlint-disable jsx-a11y/prefer-tag-over-role -- SVG graphs and loading containers require their explicit accessible roles. */
'use client';
import {
  useCallback,
  createContext,
  useContext,
  useId,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import type { Row } from '@/lib/store';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Empty,
  EmptyHeader,
  EmptyTitle,
  EmptyDescription,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Pagination,
  PaginationContent,
  PaginationItem,
} from '@/components/ui/pagination';
import {
  Table,
  TableHeader,
  TableHead,
  TableRow,
  TableBody,
  TableCell,
  TableCaption,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarFooter,
  SidebarInset,
  SidebarTrigger,
} from '@/components/ui/sidebar';
import {
  BookOpen,
  Users,
  ChartColumn,
  Library,
  Clock,
  ArrowUpRight,
} from 'lucide-react';
const href = (view: string, extra: Row = {}) =>
  '/?' +
  new URLSearchParams({
    view,
    ...Object.fromEntries(
      Object.entries(extra).map(([k, v]) => [k, String(v)]),
    ),
  }).toString();
const statusNames: Row = {
  want: 'Want to read',
  reading: 'Reading',
  read: 'Finished',
};
type Field = {
  name: string;
  label: string;
  value?: string | number;
  max?: number;
  area?: boolean;
  optional?: boolean;
  type?: string;
  choices?: [string, string][];
};
function Form({
  fields,
  submit,
  label,
  busy,
}: {
  fields: Field[];
  submit: (values: Row) => Promise<unknown>;
  label: string;
  busy: boolean;
}) {
  const formId = useId();
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        try {
          await submit(Object.fromEntries(new FormData(form)));
          form.reset();
        } catch {
          /* Error is shown by the request handler. */
        }
      }}
    >
      <fieldset disabled={busy} className="stack">
        {fields.map((f) => (
          <label key={f.name} htmlFor={formId + f.name}>
            {f.label}
            {f.choices ? (
              <Select
                name={f.name}
                defaultValue={String(f.value ?? f.choices[0][0])}
              >
                <SelectTrigger
                  id={formId + f.name}
                  className="w-full min-h-11 mt-2"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {f.choices.map(([v, l]) => (
                    <SelectItem value={v} key={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : f.area ? (
              <Textarea
                id={formId + f.name}
                className="mt-2 min-h-28"
                name={f.name}
                defaultValue={f.value ?? ''}
                maxLength={f.max}
                required={!f.optional}
              />
            ) : (
              <Input
                id={formId + f.name}
                className="mt-2 min-h-11"
                name={f.name}
                type={f.type || 'text'}
                defaultValue={f.value ?? ''}
                maxLength={f.max}
                required={!f.optional}
              />
            )}
          </label>
        ))}
        <Button type="submit" disabled={busy}>
          {busy ? 'Saving…' : label}
        </Button>
      </fieldset>
    </form>
  );
}
function EmptyState({
  title,
  children,
}: {
  title: string;
  children?: ReactNode;
}) {
  return (
    <Empty className="border my-6 py-12">
      <EmptyHeader>
        <EmptyTitle>{title}</EmptyTitle>
        <EmptyDescription>{children}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}
type NavigatorState = {
  data: Row | null;
  search: string;
  go: (url: string) => void;
  busy: boolean;
  signedIn: boolean;
  signIn: string;
  click: (payload: Row, next?: (r: Row) => string) => void;
  act: (payload: Row, next?: (r: Row) => string) => Promise<Row>;
};
const NavigatorContext = createContext<NavigatorState | null>(null);
function useNavigator() {
  const context = useContext(NavigatorContext);
  if (!context) throw new Error('Missing Navigator context');
  return context;
}

const Nav = ({
  to,
  children,
  className,
}: {
  to: string;
  children: ReactNode;
  className?: string;
}) => {
  const { go } = useNavigator();
  return (
    <a
      href={to}
      className={className}
      onClick={(e) => {
        if (!e.metaKey && !e.ctrlKey && !e.shiftKey && !e.altKey) {
          e.preventDefault();
          go(to);
        }
      }}
    >
      {children}
    </a>
  );
};
const SignIn = () => {
  const { signIn } = useNavigator();
  return (
    <EmptyState title="Keep a workspace of your own">
      <p>
        Sign in to save reading lists, track progress, and join discussions.
      </p>
      <a href={signIn} target="_top" className="text-primary font-semibold">
        Sign in with ChatGPT →
      </a>
    </EmptyState>
  );
};
const Pager = ({
  page,
  pages,
  keyName = 'page',
}: {
  page?: number;
  pages?: number;
  keyName?: string;
}) => {
  const { data, search, go } = useNavigator();
  page ??= data?.page;
  pages ??= data?.pages;
  if (!page || !pages || pages < 2) return null;
  const move = (n: number) => {
    const p = new URLSearchParams(search);
    p.set(keyName, String(n));
    go('/?' + p);
  };
  return (
    <Pagination className="mt-8">
      <PaginationContent>
        <PaginationItem>
          <Button
            variant="outline"
            disabled={page <= 1}
            onClick={() => move(page - 1)}
          >
            ← Previous
          </Button>
        </PaginationItem>
        <PaginationItem>
          <span className="px-4 text-sm">
            {page} / {pages}
          </span>
        </PaginationItem>
        <PaginationItem>
          <Button
            variant="outline"
            disabled={page >= pages}
            onClick={() => move(page + 1)}
          >
            Next →
          </Button>
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  );
};
const Paper = ({ p, remove }: { p: Row; remove?: () => void }) => {
  const { busy } = useNavigator();
  return (
    <article className="paper-row">
      <span className="paper-id">{String(p.paper_id).padStart(2, '0')}</span>
      <div className="min-w-0 flex-1">
        <div className="actions text-sm">
          <span className="tag">{p.topic}</span>
          <span className="muted">{p.publication_year}</span>
          {p.status && <span className="tag">{statusNames[p.status]}</span>}
          {p.average_rating !== undefined && (
            <span className="tag">
              {Number(p.average_rating).toFixed(2)}/5 · {p.review_count} reviews
            </span>
          )}
        </div>
        <h2 className="mt-3">
          <Nav to={href('paper', { id: p.paper_id })}>{p.title}</Nav>
        </h2>
        <p className="text-sm text-primary">
          {p.authors?.map((a: Row, i: number) => (
            <span key={a.author_id}>
              {i > 0 ? ' · ' : ''}
              <Nav to={href('network', { id: a.author_id })}>
                {a.display_name}
              </Nav>
            </span>
          ))}
        </p>
        <p className="muted">{p.abstract}</p>
        {remove && (
          <Button
            variant="ghost"
            className="text-destructive"
            disabled={busy}
            onClick={remove}
          >
            Remove from list
          </Button>
        )}
      </div>
      <Nav to={href('paper', { id: p.paper_id })} className="text-primary">
        <ArrowUpRight aria-label={'Read ' + p.title} />
      </Nav>
    </article>
  );
};
const Vote = ({ kind, item }: { kind: string; item: Row }) => {
  const { signedIn, busy, signIn, click } = useNavigator();
  return (
    <div className="actions text-sm mt-4">
      <span className="muted">
        {item.votes} {kind === 'review' ? 'helpful votes' : 'likes'}
      </span>
      {signedIn && !item.mine && (
        <Button
          variant="outline"
          disabled={busy}
          aria-pressed={item.voted}
          onClick={() =>
            click({
              action: 'vote',
              kind,
              id: item[kind + '_id'],
              like: !item.voted,
            })
          }
        >
          {item.voted ? 'Remove vote' : kind === 'review' ? 'Helpful' : 'Like'}
        </Button>
      )}
      {!signedIn && (
        <a href={signIn} target="_top" className="text-primary">
          Sign in to vote
        </a>
      )}
    </div>
  );
};
const Delete = ({
  label,
  payload,
  next,
}: {
  label: string;
  payload: Row;
  next?: (r: Row) => string;
}) => {
  const { busy, click } = useNavigator();
  return (
    <AlertDialog>
      <AlertDialogTrigger
        render={<Button variant="destructive" disabled={busy} />}
      >
        {label}
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{label}?</AlertDialogTitle>
          <AlertDialogDescription>
            This removes this record and its dependent items. This action cannot
            be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Keep it</AlertDialogCancel>
          <AlertDialogAction onClick={() => click(payload, next)}>
            Delete
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
const ListForm = ({ item }: { item?: Row }) => {
  const { busy, act } = useNavigator();
  return (
    <Form
      busy={busy}
      label={item ? 'Save changes' : 'Create private list'}
      fields={[
        { name: 'name', label: 'List name', value: item?.name, max: 150 },
        {
          name: 'description',
          label: 'Description',
          value: item?.description,
          max: 2000,
          area: true,
          optional: true,
        },
      ]}
      submit={(v) =>
        act(
          {
            ...v,
            action: item ? 'list_edit' : 'list_create',
            id: item?.list_id,
            version: item?.version,
          },
          item ? undefined : (r) => href('list', { id: r.id }),
        )
      }
    />
  );
};
export default function Navigator({
  signedIn,
  signIn,
  initialSearch,
}: {
  signedIn: boolean;
  signIn: string;
  initialSearch: string;
}) {
  const [search, setSearch] = useState(initialSearch),
    [data, setData] = useState<Row | null>(null),
    [error, setError] = useState(''),
    [notice, setNotice] = useState(''),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [revision, setRevision] = useState(0);
  const params = new URLSearchParams(search),
    view = params.get('view') || 'papers';
  const go = useCallback((url: string) => {
    const s = new URL(url, window.location.origin).search;
    window.history.pushState({}, '', s || '/');
    setSearch(s);
    setNotice('');
    setLoading(true);
    setError('');
    setData(null);
    setRevision((n) => n + 1);
    window.scrollTo(0, 0);
  }, []);
  useEffect(() => {
    const back = () => {
      setSearch(window.location.search);
      setNotice('');
      setLoading(true);
      setError('');
      setData(null);
      setRevision((n) => n + 1);
    };
    window.addEventListener('popstate', back);
    return () => window.removeEventListener('popstate', back);
  }, []);
  useEffect(() => {
    const c = new AbortController();
    fetch('/api/data' + search, { signal: c.signal, cache: 'no-store' })
      .then(async (r) => {
        const d = (await r.json()) as Row;
        if (!r.ok) throw new Error(d.error || 'Unable to load this page.');
        return d;
      })
      .then(setData)
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e.message);
      })
      .finally(() => {
        if (!c.signal.aborted) setLoading(false);
      });
    return () => c.abort();
  }, [search, revision]);
  const reload = () => {
    setLoading(true);
    setError('');
    setData(null);
    setRevision((n) => n + 1);
  };
  const act = async (payload: Row, next?: (result: Row) => string) => {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const r = await fetch('/api/data', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Navigator-Action': '1',
        },
        body: JSON.stringify(payload),
      });
      const result = (await r.json()) as Row;
      if (!r.ok) throw new Error(result.error || 'Unable to save.');
      if (next) go(next(result));
      else reload();
      setNotice('Saved.');
      return result;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unable to save.');
      throw e;
    } finally {
      setBusy(false);
    }
  };
  const click = (payload: Row, next?: (r: Row) => string) => {
    void act(payload, next).catch(() => {});
  };
  const menu: [string, string, typeof BookOpen][] = [
    ['papers', 'Paper library', BookOpen],
    ['authors', 'Authors', Users],
    ['leaderboard', 'Paper rankings', ChartColumn],
    ['community', 'Community lists', Library],
    ['progress', 'Reading progress', Clock],
    ['lists', 'My reading lists', BookOpen],
  ];
  const titles: Row = {
    papers: 'Research library',
    authors: 'Find a researcher',
    leaderboard: 'Paper rankings',
    community: 'Community reading lists',
    progress: 'Your reading progress',
    lists: 'Your reading lists',
    paper: data?.paper?.title,
    list: data?.item?.name,
    shared: data?.item?.name,
    network: data?.author?.display_name,
    post: data?.item?.title,
  };
  useEffect(() => {
    const context = (
      document as unknown as {
        modelContext?: {
          registerTool: (tool: unknown, options: unknown) => unknown;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      void Promise.resolve(
        context.registerTool(
          {
            name: 'search_papers',
            title: 'Search research papers',
            description:
              'Search papers by title or abstract and show the results in the library.',
            inputSchema: {
              type: 'object',
              properties: { query: { type: 'string', maxLength: 200 } },
              required: ['query'],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: true },
            execute: async (input: unknown) => {
              const q = (input as { query?: unknown })?.query;
              if (typeof q !== 'string' || q.length > 200)
                throw new Error(
                  'query must be a string of at most 200 characters',
                );
              const r = await fetch(
                '/api/data?' + new URLSearchParams({ view: 'papers', q }),
              );
              const d = (await r.json()) as Row;
              if (!r.ok) throw new Error(d.error);
              go(href('papers', { q }));
              return {
                total: d.total,
                papers: d.rows.map((p: Row) => ({
                  id: p.paper_id,
                  title: p.title,
                })),
              };
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {
      /* Unsupported browser implementation. */
    }
    return () => lifecycle.abort();
  }, [go]);
  return (
    <NavigatorContext.Provider
      value={{ data, search, go, busy, signedIn, signIn, click, act }}
    >
      <SidebarProvider>
        <a href="#main" className="sr-only focus:not-sr-only">
          Skip to content
        </a>
        <Sidebar>
          <SidebarHeader className="p-6 pt-8">
            <Nav to="/" className="nav-brand">
              RESEARCH
              <br />
              NAVIGATOR
            </Nav>
          </SidebarHeader>
          <SidebarContent>
            <SidebarGroup>
              <SidebarGroupLabel>DISCOVER & READ</SidebarGroupLabel>
              <SidebarMenu>
                {menu.map(([key, label, Icon]) => (
                  <SidebarMenuItem key={key}>
                    <SidebarMenuButton
                      isActive={view === key}
                      render={<a href={href(key)} aria-label={label} />}
                      onClick={(e) => {
                        e.preventDefault();
                        go(href(key));
                      }}
                      className="h-11 text-sm"
                    >
                      <Icon />
                      {label}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroup>
          </SidebarContent>
          <SidebarFooter className="p-6">
            <p className="text-sm opacity-80">
              Fictional papers for learning.
              <br />
              Your reading progress stays private.
            </p>
            {signedIn ? (
              <>
                <details>
                  <summary className="cursor-pointer text-sm">
                    {data?.profile?.display_name || 'Your profile'}
                  </summary>
                  <div className="pt-3 text-sidebar-foreground [&_input]:text-foreground">
                    <Form
                      label="Set public display name"
                      busy={busy}
                      fields={[
                        {
                          name: 'name',
                          label: 'Public display name',
                          value: data?.profile?.display_name,
                          max: 60,
                        },
                      ]}
                      submit={(v) => act({ action: 'profile', ...v })}
                    />
                  </div>
                </details>
                <a
                  href="/signout-with-chatgpt?return_to=%2F"
                  target="_top"
                  className="text-sm"
                >
                  Sign out →
                </a>
              </>
            ) : (
              <a href={signIn} target="_top" className="text-sm font-semibold">
                Sign in with ChatGPT →
              </a>
            )}
          </SidebarFooter>
        </Sidebar>
        <SidebarInset className="bg-background">
          <header className="border-b px-6 py-4 flex items-center gap-4">
            <SidebarTrigger />
            <span className="text-sm">
              ML Research Navigator <span className="muted">/ Discover</span>
            </span>
            <a
              className="ml-auto text-sm text-primary"
              href="https://github.com/Autumn-cyber-aka/ml-research-navigator/blob/main/docs/LEARNING_GUIDE.md"
              target="_blank"
              rel="noreferrer"
            >
              入门教程 ↗
            </a>
          </header>
          <main id="main" className="p-6 md:p-12 max-w-6xl w-full mx-auto">
            <p className="eyebrow mb-3">
              {view === 'papers'
                ? 'Your next idea starts here'
                : view === 'network'
                  ? 'Follow a collaboration'
                  : 'A collection of connections'}
            </p>
            <h1>{titles[view] || 'Research Navigator'}</h1>
            {view === 'papers' && (
              <p className="muted mt-4 mb-8">
                Find a paper worth reading. Make a connection worth keeping.
              </p>
            )}
            {['papers', 'authors', 'leaderboard'].includes(view) && (
              <form
                className="panel mt-7 flex gap-4 items-end flex-wrap"
                onSubmit={(e) => {
                  e.preventDefault();
                  const values = Object.fromEntries(
                    new FormData(e.currentTarget),
                  );
                  go(href(view, values));
                }}
              >
                {view !== 'leaderboard' && (
                  <label htmlFor="search-q" className="flex-1 min-w-44">
                    {view === 'authors'
                      ? 'Researcher name'
                      : 'Title or abstract'}
                    <Input
                      name="q"
                      id="search-q"
                      defaultValue={params.get('q') || ''}
                      maxLength={200}
                      placeholder="Search…"
                      key={view + (params.get('q') || '')}
                    />
                  </label>
                )}
                {view === 'papers' && (
                  <label htmlFor="search-author" className="flex-1 min-w-40">
                    Author
                    <Input
                      name="author"
                      id="search-author"
                      defaultValue={params.get('author') || ''}
                      maxLength={200}
                    />
                  </label>
                )}
                {view !== 'authors' && (
                  <label htmlFor="search-year" className="w-28">
                    Year
                    <Input
                      name="year"
                      id="search-year"
                      type="number"
                      min={1900}
                      max={2100}
                      defaultValue={params.get('year') || ''}
                      placeholder="Any"
                    />
                  </label>
                )}
                {view === 'leaderboard' && (
                  <label htmlFor="search-minimum">
                    Minimum reviews
                    <Input
                      name="minimum"
                      id="search-minimum"
                      type="number"
                      min={1}
                      max={1000}
                      defaultValue={params.get('minimum') || 2}
                    />
                  </label>
                )}
                <Button type="submit">
                  {view === 'leaderboard' ? 'Apply' : 'Search'}
                </Button>
                <Button variant="ghost" onClick={() => go(href(view))}>
                  Clear
                </Button>
              </form>
            )}
            {view === 'leaderboard' && (
              <p className="muted mt-4">
                Average user rating, then review count. At least two reviews by
                default. Helpful votes do not change the score.
              </p>
            )}
            {error && (
              <div className="panel border-destructive mt-6" role="alert">
                <p>{error}</p>
                <Button variant="outline" onClick={reload}>
                  Reload
                </Button>
              </div>
            )}
            {notice && (
              <p role="status" className="tag mt-5">
                {notice}
              </p>
            )}
            {loading ? (
              <div
                className="stack mt-8"
                role="status"
                aria-label="Loading records"
              >
                <Skeleton className="h-5 w-28" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : !signedIn && ['lists', 'list', 'progress'].includes(view) ? (
              <SignIn />
            ) : (
              data && (
                <>
                  {['papers', 'progress', 'leaderboard'].includes(view) && (
                    <>
                      <p className="muted mt-6">{data.total} papers</p>
                      {!data.rows.length && (
                        <EmptyState
                          title={
                            view === 'leaderboard'
                              ? 'Not enough reviews yet'
                              : 'No papers here yet'
                          }
                        >
                          {view === 'progress'
                            ? 'Open a paper and set its reading status.'
                            : 'Try changing the filters.'}
                        </EmptyState>
                      )}
                      {data.rows.map((p: Row) => (
                        <Paper p={p} key={p.paper_id} />
                      ))}
                      <Pager />
                    </>
                  )}
                  {view === 'authors' && (
                    <>
                      <p className="muted mt-6">{data.total} researchers</p>
                      <div className="grid sm:grid-cols-2 gap-4 mt-6">
                        {data.rows.map((a: Row) => (
                          <section className="panel" key={a.author_id}>
                            <p className="eyebrow">
                              RESEARCHER {String(a.author_id).padStart(2, '0')}
                            </p>
                            <h2>
                              <Nav to={href('network', { id: a.author_id })}>
                                {a.display_name}
                              </Nav>
                            </h2>
                            <p className="muted">
                              {a.paper_count} papers in this collection
                            </p>
                            <Nav
                              to={href('papers', { author_id: a.author_id })}
                              className="text-primary"
                            >
                              Browse papers →
                            </Nav>
                          </section>
                        ))}
                      </div>
                      {!data.rows.length && (
                        <EmptyState title="No researchers match" />
                      )}
                      <Pager />
                    </>
                  )}
                  {view === 'network' && (
                    <>
                      <p className="muted mt-4">
                        Direct coauthors in this fictional collection. Numbers
                        count shared papers.
                      </p>
                      <Nav
                        to={href('papers', {
                          author_id: data.author.author_id,
                        })}
                        className="text-primary"
                      >
                        Browse this author’s papers →
                      </Nav>
                      {data.truncated && (
                        <p>
                          Showing the 24 most frequent direct collaborators.
                        </p>
                      )}
                      {!data.neighbors.length ? (
                        <EmptyState title="No coauthors in this collection" />
                      ) : (
                        <>
                          <div className="network panel mt-6">
                            <svg
                              viewBox="0 0 800 580"
                              role="img"
                              aria-label={
                                'Coauthors of ' + data.author.display_name
                              }
                            >
                              {data.neighbors.map((n: Row, i: number) => {
                                const angle =
                                    (2 * Math.PI * i) / data.neighbors.length -
                                    Math.PI / 2,
                                  x = 400 + 280 * Math.cos(angle),
                                  y = 290 + 210 * Math.sin(angle);
                                return (
                                  <g key={n.author_id}>
                                    <line x1={400} y1={290} x2={x} y2={y} />
                                    <text
                                      x={(400 + x) / 2}
                                      y={(290 + y) / 2 - 8}
                                    >
                                      {n.shared_papers}
                                    </text>
                                    <a
                                      href={href('network', {
                                        id: n.author_id,
                                      })}
                                      onClick={(e) => {
                                        e.preventDefault();
                                        go(
                                          href('network', { id: n.author_id }),
                                        );
                                      }}
                                      aria-label={n.display_name}
                                    >
                                      <circle cx={x} cy={y} r={25} />
                                      <text className="initial" x={x} y={y + 5}>
                                        {n.display_name.slice(-1)}
                                      </text>
                                      <text x={x} y={y + 43}>
                                        {n.display_name}
                                      </text>
                                    </a>
                                  </g>
                                );
                              })}
                              <circle cx={400} cy={290} r={32} />
                              <text className="initial" x={400} y={296}>
                                {data.author.display_name.slice(-1)}
                              </text>
                              <text x={400} y={340}>
                                {data.author.display_name}
                              </text>
                            </svg>
                          </div>
                          <Table>
                            <TableCaption>
                              Direct collaborators — the same data as the graph
                            </TableCaption>
                            <TableHeader>
                              <TableRow>
                                <TableHead>Researcher</TableHead>
                                <TableHead>Shared papers</TableHead>
                              </TableRow>
                            </TableHeader>
                            <TableBody>
                              {data.neighbors.map((n: Row) => (
                                <TableRow key={n.author_id}>
                                  <TableCell>
                                    <Nav
                                      to={href('network', { id: n.author_id })}
                                    >
                                      {n.display_name}
                                    </Nav>
                                  </TableCell>
                                  <TableCell>{n.shared_papers}</TableCell>
                                </TableRow>
                              ))}
                            </TableBody>
                          </Table>
                        </>
                      )}
                    </>
                  )}
                  {['lists', 'community'].includes(view) && (
                    <div className="content-grid mt-8">
                      <section>
                        <p className="muted">
                          {data.total}{' '}
                          {view === 'lists' ? 'personal' : 'public'} lists
                        </p>
                        {data.rows.map((l: Row) => (
                          <article key={l.list_id} className="panel mb-4">
                            <p className="eyebrow">
                              {l.is_public ? 'Public' : 'Private'} ·{' '}
                              {l.paper_count} papers
                            </p>
                            <h2>
                              <Nav
                                to={href(view === 'lists' ? 'list' : 'shared', {
                                  id: l.list_id,
                                })}
                              >
                                {l.name}
                              </Nav>
                            </h2>
                            <p className="muted prose">{l.description}</p>
                            <p className="text-sm">
                              By {l.display_name || data.profile?.display_name}
                            </p>
                            {l.is_public && <Vote kind="list" item={l} />}
                          </article>
                        ))}
                        {!data.rows.length && (
                          <EmptyState
                            title={
                              view === 'lists'
                                ? 'Make room for your next idea'
                                : 'No public lists yet'
                            }
                          >
                            {view === 'lists'
                              ? 'Create your first private reading list.'
                              : 'Owners can choose to publish a list.'}
                          </EmptyState>
                        )}
                        <Pager />
                      </section>
                      <aside>
                        {view === 'lists' ? (
                          <section className="panel">
                            <h2 className="mb-5">New reading list</h2>
                            <ListForm />
                          </section>
                        ) : (
                          <section className="panel">
                            <h2>Share a reading path</h2>
                            <p className="muted">
                              Create a list in your workspace, then publish it
                              when you are ready. Your reading progress stays
                              private.
                            </p>
                            <Nav to={href('lists')} className="text-primary">
                              Your lists →
                            </Nav>
                          </section>
                        )}
                      </aside>
                    </div>
                  )}
                  {['list', 'shared'].includes(view) && (
                    <>
                      <p className="muted prose mt-4">
                        {data.item.description}
                      </p>
                      <p className="eyebrow mt-4">
                        {data.item.is_public ? 'Public' : 'Private'} collection
                        · {data.total} papers
                      </p>
                      {view === 'shared' && (
                        <Vote kind="list" item={data.item} />
                      )}
                      <div className="content-grid mt-6">
                        <section>
                          {data.rows.map((p: Row) => (
                            <Paper
                              key={p.paper_id}
                              p={p}
                              remove={
                                view === 'list'
                                  ? () =>
                                      click({
                                        action: 'list_remove',
                                        id: data.item.list_id,
                                        version: data.item.version,
                                        paper_id: p.paper_id,
                                      })
                                  : undefined
                              }
                            />
                          ))}
                          {!data.rows.length && (
                            <EmptyState title="A new path starts with one paper">
                              <Nav to={href('papers')}>
                                Browse the library →
                              </Nav>
                            </EmptyState>
                          )}
                          <Pager />
                        </section>
                        <aside className="stack self-start">
                          {view === 'list' ? (
                            <>
                              <section className="panel">
                                <h2>Sharing</h2>
                                <p className="muted">
                                  {data.item.is_public
                                    ? 'This list is visible in Community lists.'
                                    : 'Only you can read this list.'}{' '}
                                  Personal reading progress stays private.
                                </p>
                                <Button
                                  variant="outline"
                                  disabled={busy}
                                  onClick={() =>
                                    click({
                                      action: 'list_visibility',
                                      id: data.item.list_id,
                                      version: data.item.version,
                                      public: !data.item.is_public,
                                    })
                                  }
                                >
                                  {data.item.is_public
                                    ? 'Make private'
                                    : 'Publish this list'}
                                </Button>
                                {!!data.item.is_public && (
                                  <p>
                                    <Nav
                                      to={href('shared', {
                                        id: data.item.list_id,
                                      })}
                                      className="text-primary"
                                    >
                                      Open shared link →
                                    </Nav>
                                  </p>
                                )}
                              </section>
                              <section className="panel">
                                <h2 className="mb-4">Add several papers</h2>
                                <Form
                                  busy={busy}
                                  label="Add papers"
                                  fields={[
                                    {
                                      name: 'ids',
                                      label: 'Paper IDs, separated by commas',
                                      max: 1000,
                                    },
                                  ]}
                                  submit={(v) =>
                                    act({
                                      action: 'list_add',
                                      id: data.item.list_id,
                                      version: data.item.version,
                                      paper_ids: v.ids
                                        .split(',')
                                        .map((x: string) => x.trim()),
                                    })
                                  }
                                />
                                <p className="muted text-sm">
                                  Repeated IDs are kept once. If any ID is
                                  invalid, nothing is added.
                                </p>
                              </section>
                              <details className="panel">
                                <summary>Edit list</summary>
                                <div className="mt-4" key={data.item.version}>
                                  <ListForm item={data.item} />
                                </div>
                              </details>
                              <Delete
                                label="Delete list"
                                payload={{
                                  action: 'list_delete',
                                  id: data.item.list_id,
                                  version: data.item.version,
                                }}
                                next={() => href('lists')}
                              />
                            </>
                          ) : (
                            <section className="panel">
                              <h2>Selected by {data.item.display_name}</h2>
                              <p className="muted">
                                A publicly shared reading list.
                              </p>
                              {data.item.mine && (
                                <Nav
                                  to={href('list', { id: data.item.list_id })}
                                  className="text-primary"
                                >
                                  Manage your list →
                                </Nav>
                              )}
                            </section>
                          )}
                        </aside>
                      </div>
                    </>
                  )}
                  {view === 'paper' && (
                    <>
                      <p className="eyebrow mt-5">
                        {data.paper.topic} · {data.paper.publication_year} ·
                        PAPER ID {data.paper.paper_id}
                      </p>
                      <p className="text-primary">
                        {data.paper.authors.map((a: Row, i: number) => (
                          <span key={a.author_id}>
                            {i ? ' · ' : ''}
                            <Nav to={href('network', { id: a.author_id })}>
                              {a.display_name}
                            </Nav>
                          </span>
                        ))}
                      </p>
                      <div className="content-grid mt-8">
                        <section>
                          <div className="panel">
                            <h2>Abstract</h2>
                            <p className="prose">{data.paper.abstract}</p>
                            <p className="muted text-sm">
                              {data.paper.provenance}
                            </p>
                          </div>
                          <h2 className="mt-10">Reader reviews</h2>
                          <p className="muted">
                            {data.rating.review_count
                              ? Number(data.rating.average_rating).toFixed(2) +
                                '/5 · ' +
                                data.rating.review_count +
                                ' reviews'
                              : 'No ratings yet'}
                          </p>
                          {data.rows.map((r: Row) => (
                            <article className="panel mt-4" key={r.review_id}>
                              <p className="text-sm">
                                {r.display_name} · <strong>{r.rating}/5</strong>
                              </p>
                              <p className="prose">{r.body}</p>
                              <Vote kind="review" item={r} />
                              {r.mine && (
                                <div className="mt-3">
                                  <Delete
                                    label="Delete review"
                                    payload={{
                                      action: 'review_delete',
                                      id: r.review_id,
                                      version: r.version,
                                    }}
                                  />
                                </div>
                              )}
                            </article>
                          ))}
                          {!data.rows.length && (
                            <EmptyState title="Start a thoughtful conversation">
                              Share an observation about the paper.
                            </EmptyState>
                          )}
                          <Pager />
                          {signedIn && (
                            <section
                              className="panel mt-6"
                              key={data.my_review?.version ?? 0}
                            >
                              <h2 className="mb-4">
                                {data.my_review
                                  ? 'Edit your review'
                                  : 'Your review'}
                              </h2>
                              <Form
                                busy={busy}
                                label="Save review"
                                fields={[
                                  {
                                    name: 'rating',
                                    label: 'Rating',
                                    value: data.my_review?.rating ?? 5,
                                    choices: [
                                      ['5', '5 — Excellent'],
                                      ['4', '4 — Good'],
                                      ['3', '3 — Fair'],
                                      ['2', '2 — Weak'],
                                      ['1', '1 — Poor'],
                                    ],
                                  },
                                  {
                                    name: 'body',
                                    label: 'What did you notice?',
                                    area: true,
                                    max: 4000,
                                    value: data.my_review?.body,
                                  },
                                ]}
                                submit={(v) =>
                                  act({
                                    action: 'review_save',
                                    paper_id: data.paper.paper_id,
                                    version: data.my_review?.version ?? 0,
                                    ...v,
                                  })
                                }
                              />
                            </section>
                          )}
                          <h2 className="mt-10">Discussion</h2>
                          {data.posts.map((p: Row) => (
                            <article className="panel mt-4" key={p.post_id}>
                              <h3>
                                <Nav to={href('post', { id: p.post_id })}>
                                  {p.title}
                                </Nav>
                              </h3>
                              <p className="muted text-sm">{p.display_name}</p>
                            </article>
                          ))}
                          {!data.posts.length && (
                            <p className="muted">No discussion yet.</p>
                          )}
                          <Pager
                            page={data.post_page}
                            pages={data.post_pages}
                            keyName="post_page"
                          />
                          {signedIn && (
                            <details className="panel mt-5">
                              <summary>Start a discussion</summary>
                              <div className="mt-4">
                                <Form
                                  busy={busy}
                                  label="Post discussion"
                                  fields={[
                                    { name: 'title', label: 'Title', max: 200 },
                                    {
                                      name: 'body',
                                      label: 'Your question or idea',
                                      max: 8000,
                                      area: true,
                                    },
                                  ]}
                                  submit={(v) =>
                                    act(
                                      {
                                        action: 'post_create',
                                        paper_id: data.paper.paper_id,
                                        ...v,
                                      },
                                      (r) => href('post', { id: r.id }),
                                    )
                                  }
                                />
                              </div>
                            </details>
                          )}
                        </section>
                        <aside className="stack self-start">
                          {signedIn ? (
                            <>
                              <section
                                className="panel"
                                key={data.paper.state_version}
                              >
                                <h2 className="mb-4">Reading progress</h2>
                                <Form
                                  busy={busy}
                                  label="Save progress"
                                  fields={[
                                    {
                                      name: 'status',
                                      label: 'Your status',
                                      value: data.paper.status || 'want',
                                      choices: Object.entries(statusNames) as [
                                        string,
                                        string,
                                      ][],
                                    },
                                  ]}
                                  submit={(v) =>
                                    act({
                                      action: 'progress',
                                      paper_id: data.paper.paper_id,
                                      version: data.paper.state_version,
                                      ...v,
                                    })
                                  }
                                />
                              </section>
                              <section className="panel">
                                <h2>Keep it in a list</h2>
                                <p className="muted">
                                  Add paper #{data.paper.paper_id} using the
                                  “Add several papers” box in your reading list.
                                </p>
                                <Nav
                                  to={href('lists')}
                                  className="text-primary"
                                >
                                  Open your lists →
                                </Nav>
                              </section>
                            </>
                          ) : (
                            <SignIn />
                          )}
                        </aside>
                      </div>
                    </>
                  )}
                  {view === 'post' && (
                    <>
                      <p className="mt-4 text-primary">
                        <Nav to={href('paper', { id: data.item.paper_id })}>
                          ← Back to paper
                        </Nav>
                      </p>
                      <article className="panel mt-6">
                        <p className="muted text-sm">
                          {data.item.display_name}
                        </p>
                        <p className="prose">{data.item.body}</p>
                        <Vote kind="post" item={data.item} />
                        {data.item.mine && (
                          <div className="stack mt-5">
                            <details>
                              <summary>Edit discussion</summary>
                              <div className="mt-4" key={data.item.version}>
                                <Form
                                  busy={busy}
                                  label="Save discussion"
                                  fields={[
                                    {
                                      name: 'title',
                                      label: 'Title',
                                      max: 200,
                                      value: data.item.title,
                                    },
                                    {
                                      name: 'body',
                                      label: 'Discussion',
                                      area: true,
                                      max: 8000,
                                      value: data.item.body,
                                    },
                                  ]}
                                  submit={(v) =>
                                    act({
                                      action: 'post_edit',
                                      id: data.item.post_id,
                                      version: data.item.version,
                                      ...v,
                                    })
                                  }
                                />
                              </div>
                            </details>
                            <Delete
                              label="Delete discussion"
                              payload={{
                                action: 'post_delete',
                                id: data.item.post_id,
                                version: data.item.version,
                              }}
                              next={() =>
                                href('paper', { id: data.item.paper_id })
                              }
                            />
                          </div>
                        )}
                      </article>
                      <h2 className="mt-8">Replies · {data.total}</h2>
                      {data.rows.map((r: Row) => (
                        <article className="panel mt-4" key={r.reply_id}>
                          <p className="muted text-sm">{r.display_name}</p>
                          <p className="prose">{r.body}</p>
                          {r.mine && (
                            <div className="stack">
                              <details>
                                <summary>Edit reply</summary>
                                <div className="mt-4" key={r.version}>
                                  <Form
                                    busy={busy}
                                    label="Save reply"
                                    fields={[
                                      {
                                        name: 'body',
                                        label: 'Reply',
                                        area: true,
                                        max: 4000,
                                        value: r.body,
                                      },
                                    ]}
                                    submit={(v) =>
                                      act({
                                        action: 'reply_edit',
                                        id: r.reply_id,
                                        version: r.version,
                                        ...v,
                                      })
                                    }
                                  />
                                </div>
                              </details>
                              <Delete
                                label="Delete reply"
                                payload={{
                                  action: 'reply_delete',
                                  id: r.reply_id,
                                  version: r.version,
                                }}
                              />
                            </div>
                          )}
                        </article>
                      ))}
                      <Pager />
                      {signedIn ? (
                        <section className="panel mt-6">
                          <h2 className="mb-4">Add a reply</h2>
                          <Form
                            busy={busy}
                            label="Post reply"
                            fields={[
                              {
                                name: 'body',
                                label: 'Your response',
                                area: true,
                                max: 4000,
                              },
                            ]}
                            submit={(v) =>
                              act({
                                action: 'reply_create',
                                post_id: data.item.post_id,
                                ...v,
                              })
                            }
                          />
                        </section>
                      ) : (
                        <SignIn />
                      )}
                    </>
                  )}
                </>
              )
            )}
            <footer className="border-t mt-14 pt-6 text-sm muted flex justify-between gap-4 flex-wrap">
              <span>Built for thoughtful reading.</span>
              <a
                href="https://github.com/Autumn-cyber-aka/ml-research-navigator"
                target="_blank"
                rel="noreferrer"
              >
                Source & learning guide ↗
              </a>
            </footer>
          </main>
        </SidebarInset>
      </SidebarProvider>
    </NavigatorContext.Provider>
  );
}
