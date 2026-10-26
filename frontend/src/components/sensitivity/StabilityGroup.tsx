type StabilityGroupProps = {
  title: string;
  ids: string[];
  emptyText: string;
  optionName: (id: string) => string;
};

export function StabilityGroup({
  title,
  ids,
  emptyText,
  optionName
}: StabilityGroupProps) {
  return (
    <div className="sensitivity-stability__group">
      <h3 className="sensitivity-stability__title">{title}</h3>
      {ids.length === 0 ? (
        <p className="hint">{emptyText}</p>
      ) : (
        <ul className="sensitivity-stability__list">
          {ids.map((id) => (
            <li className="sensitivity-stability__item" key={id}>
              <span className="sensitivity-stability__name">{optionName(id)}</span>
              <span className="sensitivity-stability__id">{id}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
