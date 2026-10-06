'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { CityNewsView } from '@/components/city-news';
import { api, getCityNews } from '@/lib/api';
import type { City, NewsItem } from '@/lib/types';

interface NewsPageState {
  city: City | null | undefined; // undefined = loading, null = not found
  news: NewsItem[];
  loading: boolean;
  error: string | null;
}

const INITIAL: NewsPageState = { city: undefined, news: [], loading: true, error: null };

/** City news page (`/city/<slug>/news`) — the news feed moved out of the home page. */
export default function CityNewsPage() {
  const { slug } = useParams<{ slug: string }>();
  const [state, setState] = useState<NewsPageState>(INITIAL);

  useEffect(() => {
    let alive = true;
    setState(INITIAL);

    (async () => {
      let city: City | null;
      try {
        const list = await api.get<City[]>('/cities');
        city = list.find((c) => c.slug === slug) ?? null;
      } catch {
        if (alive) setState((s) => ({ ...s, city: null, loading: false, error: 'دریافت اطلاعات شهر ناموفق بود' }));
        return;
      }
      if (!alive) return;

      if (!city) {
        setState((s) => ({ ...s, city: null, loading: false }));
        return;
      }
      setState((s) => ({ ...s, city }));

      try {
        const news = await getCityNews(city.slug, 30);
        if (alive) setState((s) => ({ ...s, news, loading: false }));
      } catch (err) {
        if (alive) {
          setState((s) => ({
            ...s,
            loading: false,
            error: err instanceof Error ? err.message : 'دریافت اخبار شهر ناموفق بود',
          }));
        }
      }
    })();

    return () => {
      alive = false;
    };
  }, [slug]);

  if (state.city === undefined) {
    return (
      <p className="muted loading" aria-busy>
        در حال بارگذاری…
      </p>
    );
  }

  if (state.city === null) {
    return (
      <div className="banner banner--error" role="alert">
        <span>چنین شهری پیدا نشد.</span>
        <Link href="/" className="btn btn-ghost">
          بازگشت به فهرست شهرها
        </Link>
      </div>
    );
  }

  return <CityNewsView city={state.city} news={state.news} loading={state.loading} error={state.error} />;
}
