import { redirect } from 'next/navigation';

/** Legacy route: the live control room is the only dashboard. */
export default function Dashboard() {
  redirect('/live');
}
