import { supabase, type Argument, type ArgumentPerson, type Match, type Person, type Point } from './supabase'

// Column lists are explicit: the database only lets clients read these columns.
const PERSON = 'id, name, color, is_me, created_at'
const ARGUMENT = 'id, title, settled, x, z, placed_by_meaning, created_at, updated_at'
const POINT = 'id, argument_id, person_id, text, created_at'

function check<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message)
  return res.data as T
}

export type Garden = {
  name: string
  people: Person[]
  arguments: Argument[]
  links: ArgumentPerson[]
  points: Point[]
}

export async function loadGarden(userId: string): Promise<Garden> {
  const [profile, people, args, links, points] = await Promise.all([
    supabase.from('profiles').select('display_name').eq('id', userId).maybeSingle(),
    supabase.from('people').select(PERSON).order('is_me', { ascending: false }).order('created_at'),
    supabase.from('arguments').select(ARGUMENT).order('created_at'),
    supabase.from('argument_people').select('argument_id, person_id'),
    supabase.from('points').select(POINT).order('created_at'),
  ])
  return {
    name: check(profile)?.display_name ?? '',
    people: check(people) ?? [],
    arguments: check(args) ?? [],
    links: check(links) ?? [],
    points: check(points) ?? [],
  }
}

export async function saveName(userId: string, name: string) {
  check(await supabase.from('profiles').upsert({ id: userId, display_name: name }).select('id'))
}

export async function addPerson(name: string, color: string): Promise<Person> {
  return check(await supabase.from('people').insert({ name, color }).select(PERSON).single())
}

export async function updatePerson(id: string, name: string, color: string): Promise<Person> {
  return check(await supabase.from('people').update({ name, color }).eq('id', id).select(PERSON).single())
}

export async function addArgument(title: string, personIds: string[]): Promise<{ argument: Argument; links: ArgumentPerson[] }> {
  const argument: Argument = check(await supabase.from('arguments').insert({ title }).select(ARGUMENT).single())
  const rows = personIds.map((person_id) => ({ argument_id: argument.id, person_id }))
  const links: ArgumentPerson[] = check(await supabase.from('argument_people').insert(rows).select('argument_id, person_id'))
  return { argument, links }
}

export async function addPeopleToArgument(argumentId: string, personIds: string[]): Promise<ArgumentPerson[]> {
  const rows = personIds.map((person_id) => ({ argument_id: argumentId, person_id }))
  return check(await supabase.from('argument_people').insert(rows).select('argument_id, person_id'))
}

export async function updateArgument(id: string, patch: { title?: string; settled?: boolean }): Promise<Argument> {
  return check(await supabase.from('arguments').update(patch).eq('id', id).select(ARGUMENT).single())
}

export async function deleteArgument(id: string) {
  check(await supabase.from('arguments').delete().eq('id', id).select('id'))
}

export async function addPoint(argumentId: string, personId: string, text: string): Promise<Point> {
  return check(await supabase.from('points').insert({ argument_id: argumentId, person_id: personId, text }).select(POINT).single())
}

export async function updatePoint(id: string, text: string): Promise<Point> {
  return check(await supabase.from('points').update({ text }).eq('id', id).select(POINT).single())
}

export async function deletePoint(id: string) {
  check(await supabase.from('points').delete().eq('id', id).select('id'))
}

// Runs in the background after a point is saved; the tree may move closer to similar ones.
export async function embedPoint(pointId: string): Promise<Pick<Argument, 'id' | 'x' | 'z' | 'placed_by_meaning'> | null> {
  const { data, error } = await supabase.functions.invoke('embed', { body: { point_id: pointId } })
  if (error) throw error
  return data?.tree ?? null
}

export async function search(query: string): Promise<Match[]> {
  const { data, error } = await supabase.functions.invoke('embed', { body: { query } })
  if (error) throw error
  return data?.matches ?? []
}

export async function similarPoints(argumentId: string): Promise<Match[]> {
  return check(await supabase.rpc('similar_points', { arg: argumentId, n: 6 })) ?? []
}
