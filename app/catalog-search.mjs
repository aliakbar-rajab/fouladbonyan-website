/**
 * Fill each product group with the searchable rows of its own catalog.
 *
 * `baseGroups` are the groups to fill, in display order; `catalogs` is one
 * GroupCatalog per group, matched by id.
 */
export function buildCatalogSearchGroups(baseGroups, catalogs) {
  const categoriesByGroup = new Map(
    catalogs.map((catalog) => [catalog.id, catalog.categories]),
  );

  return baseGroups.map((group) => ({
    ...group,
    rows: (categoriesByGroup.get(group.id) ?? []).flatMap(
      (category) =>
        category.factories.flatMap((factory) =>
          factory.rows.map((row) => ({
            product: row.title,
            origin: row.factory || factory.name || row.delivery || "—",
            unit: row.unit || "—",
            categoryId: category.id,
            factory: factory.name,
            size: row.size,
            searchText: [
              category.label,
              category.sourceTitle,
              row.title,
              row.size,
              row.specification,
              row.standard,
              row.grade,
              row.branchLength,
              row.form,
              row.delivery,
              row.unit,
              row.factory,
              factory.name,
              ...(row.specifications ?? []).flatMap((item) => [
                item.label,
                item.value,
              ]),
            ]
              .filter(Boolean)
              .join(" "),
          })),
        ),
    ),
  }));
}
