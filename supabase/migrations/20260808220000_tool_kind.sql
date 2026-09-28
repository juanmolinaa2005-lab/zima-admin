-- Distinguish apps vs social links in project_tools
alter table public.project_tools
  add column if not exists tool_kind text not null default 'app';

alter table public.project_tools
  drop constraint if exists project_tools_tool_kind_check;

alter table public.project_tools
  add constraint project_tools_tool_kind_check
  check (tool_kind in ('app', 'social'));

create index if not exists project_tools_kind_idx
  on public.project_tools(project_id, tool_kind);
