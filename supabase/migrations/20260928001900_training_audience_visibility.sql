-- ============================================================================
-- MJ FOREST GURU — 1900 Training materials: audience-based visibility
-- Owners/admins/managers (manage_safety) see every material. Everybody else sees
-- published materials meant for them: empty audience = everyone, otherwise at
-- least one of the user's roles must be in the audience (e.g. the owner handbook
-- stays hidden from field workers).
-- ============================================================================
drop policy if exists training_materials_select on public.training_materials;
create policy training_materials_select on public.training_materials for select to authenticated
  using (
    app.is_member(organization_id) and (
      app.has_perm(organization_id, 'manage_safety')
      or (
        status = 'published' and deleted_at is null
        and (cardinality(audience) = 0 or audience && public.my_roles(organization_id))
      )
    )
  );
