import { useEffect } from 'react';
import { assetUrl, categoryLabel, topics, type Topic } from './content';
import { useHashRoute } from './hooks';
import { Markdown } from './components/Markdown';

function groupByCategory(list: Topic[]) {
  const groups = new Map<string, Topic[]>();
  for (const topic of list) {
    if (!groups.has(topic.category)) groups.set(topic.category, []);
    groups.get(topic.category)!.push(topic);
  }
  return [...groups];
}

export function App() {
  const route = useHashRoute();
  const topic = topics.find(t => t.dir === route);

  useEffect(() => {
    window.scrollTo(0, 0);
    document.title = topic ? `${topic.title} · Visualize` : 'Visualize';
  }, [topic]);

  return (
    <div className="page">
      <header className="topbar">
        <a href="#/">← All topics</a>
      </header>
      <main>{topic ? <TopicPage topic={topic} /> : <Home notFound={route !== ''} />}</main>
    </div>
  );
}

function TopicPage({ topic }: { topic: Topic }) {
  return (
    <article>
      <h1>{topic.title}</h1>
      {topic.summary && <p className="summary">{topic.summary}</p>}
      {topic.source && (
        <p className="small">
          <a href={assetUrl(topic.dir, topic.source)} target="_blank" rel="noreferrer">My original notes</a>
        </p>
      )}
      <Markdown source={topic.body} dir={topic.dir} />
    </article>
  );
}

function Home({ notFound }: { notFound: boolean }) {
  return (
    <div>
      <h1>What I have learned</h1>
      {notFound && <p className="error">That topic does not exist.</p>}
      {groupByCategory(topics).map(([category, list]) => (
        <section key={category}>
          <h2>{categoryLabel(category)}</h2>
          <ul className="topic-list">
            {list.map(t => (
              <li key={t.dir}>
                <a href={`#/${t.dir}`}>{t.title}</a>
                {t.summary && <span className="small"> {t.summary}</span>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
