-- Reference only: creation-time definitions supplied by the user on 2026-10-27.
-- Not a migration. Live database definitions have not been independently retrieved.
-- Local tests install these functions only in a disposable fixture database.
create function public.record_mock_exam_results(
  p_exam_id text,
  p_exam_version integer,
  p_results jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_section text;
  v_scoring text;
  v_answer text;
  v_points numeric;
  v_max_points numeric;
  v_seen text[] := array[]::text[];
  v_updated integer := 0;
  v_rows integer;
begin
  if coalesce(p_exam_id, '') !~
     '^[A-Za-z0-9_-]{1,100}$'
     or p_exam_version is null
     or p_exam_version < 1 then
    raise exception 'Invalid exam identifier';
  end if;
  if p_results is null
     or jsonb_typeof(p_results) <> 'array' then
    raise exception 'Results must be an array';
  end if;
  if jsonb_array_length(p_results) > 100 then
    raise exception 'Too many results';
  end if;
  for v_item in select value from jsonb_array_elements(p_results)
  loop
    if jsonb_typeof(v_item) <> 'object' then
      raise exception 'Invalid result item';
    end if;
    v_section := v_item->>'section_id';
    v_scoring := v_item->>'scoring_id';
    v_answer := v_item->>'answer';
    if v_section is null or v_section not in
      ('q1', 'q2a', 'q2b', 'q3', 'q4') then
      raise exception 'Invalid section';
    end if;
    if coalesce(v_scoring, '') !~ '^[A-Za-z0-9_-]{1,100}$' then
      raise exception 'Invalid scoring ID';
    end if;
    if v_scoring = any(v_seen) then
      raise exception 'Duplicate scoring ID';
    end if;
    v_seen := array_append(v_seen, v_scoring);
    if coalesce(v_answer, '') !~ '^[0-9A-F_]([|][0-9A-F_])*$'
       or length(v_answer) > 127 then
      raise exception 'Invalid answer format';
    end if;
    if replace(replace(v_answer, '_', ''), '|', '') = '' then
      continue;
    end if;
    if jsonb_typeof(v_item->'earned_points') is distinct from 'number'
       or jsonb_typeof(v_item->'max_points') is distinct from 'number' then
      raise exception 'Invalid score format';
    end if;
    v_points := (v_item->>'earned_points')::numeric;
    v_max_points := (v_item->>'max_points')::numeric;
    if v_points < 0 or v_max_points <= 0 or v_max_points > 100
       or v_points > v_max_points
       or trunc(v_points, 2) <> v_points
       or trunc(v_max_points, 2) <> v_max_points then
      raise exception 'Invalid score';
    end if;
    insert into public.mock_exam_stats as s (
      exam_id, exam_version, section_id, scoring_id, answer_counts,
      answered_count, correct_count, points_sum, updated_at
    ) values (
      p_exam_id, p_exam_version, v_section, v_scoring,
      jsonb_build_object(v_answer, 1), 1,
      case when v_points = v_max_points then 1 else 0 end,
      v_points, now()
    ) on conflict (exam_id, exam_version, scoring_id)
    do update set
      answer_counts = jsonb_set(
        s.answer_counts, array[v_answer],
        to_jsonb(coalesce((s.answer_counts->>v_answer)::bigint, 0) + 1), true
      ),
      answered_count = s.answered_count + 1,
      correct_count = s.correct_count + case when v_points = v_max_points then 1 else 0 end,
      points_sum = s.points_sum + v_points,
      updated_at = now()
    where s.section_id = excluded.section_id;
    get diagnostics v_rows = row_count;
    if v_rows <> 1 then
      raise exception 'Scoring ID section mismatch';
    end if;
    v_updated := v_updated + 1;
  end loop;
  return jsonb_build_object('updated_count', v_updated);
end;
$$;

create function public.get_mock_exam_stats(p_exam_id text,p_exam_version integer)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'items',
    coalesce(
      jsonb_agg(
        jsonb_build_object(
          'section_id', s.section_id,
          'scoring_id', s.scoring_id,
          'answered_count', s.answered_count,
          'correct_count', s.correct_count,
          'points_sum', s.points_sum
        ) order by s.section_id, s.scoring_id
      ), '[]'::jsonb
    )
  ) from public.mock_exam_stats s
  where s.exam_id = p_exam_id and s.exam_version = p_exam_version;
$$;
