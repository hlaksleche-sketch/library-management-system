import React, { useEffect, useState } from 'react';

export function Notice({ error, success }) {
  if (error) return <p role="alert" className="notice error">{error}</p>;
  if (success) return <p role="status" className="notice success">{success}</p>;
  return null;
}

export function Table({ columns, rows, empty, renderRow }) {
  return (
    <div className="table-wrap" tabIndex={0} role="region" aria-label="Scrollable data table">
      <table>
        <thead><tr>{columns.map((column) => <th key={column} scope="col">{column}</th>)}</tr></thead>
        <tbody>
          {rows.map((row) => <tr key={row.id}>{renderRow(row)}</tr>)}
          {!rows.length && <tr><td colSpan={columns.length} className="empty">{empty}</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

export function Actions({ onEdit, onDelete, disabled }) {
  return <div className="actions">
    <button type="button" className="secondary" disabled={disabled} onClick={onEdit}>Edit</button>
    <button type="button" className="danger" disabled={disabled} onClick={onDelete}>Delete</button>
  </div>;
}

export function Fields({ fields, values, onChange }) {
  return <div className="fields">{fields.map(({ name, label, options, ...props }) => (
    <label key={name}>
      <span>{label}</span>
      {options
        ? <select {...props} value={values[name] ?? ''} onChange={(event) => onChange(name, event.target.value)}>
            {options.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
        : <input {...props} value={values[name] ?? ''} onChange={(event) => onChange(name, event.target.value)} />}
    </label>
  ))}</div>;
}

export function Editor({ title, fields, defaults, selected, onSave, onCancel, busy, saveLabel = 'Save' }) {
  const [values, setValues] = useState(() => ({ ...defaults, ...selected }));
  return (
    <form className="panel editor" onSubmit={(event) => {
      event.preventDefault();
      onSave(values, selected);
    }}>
      <h2>{selected ? 'Edit ' + title : title}</h2>
      <Fields fields={fields} values={values}
        onChange={(name, value) => setValues((previous) => ({ ...previous, [name]: value }))} />
      <div className="actions">
        <button disabled={busy}>{busy ? 'Working…' : saveLabel}</button>
        {selected && <button type="button" className="secondary" onClick={onCancel} disabled={busy}>Cancel</button>}
      </div>
    </form>
  );
}

export function useRecords(api, paths) {
  const [records, setRecords] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);

  const loadRecords = () => Promise.all(paths.map((path) => api(path)));

  useEffect(() => {
    let active = true;
    loadRecords().then((data) => {
      if (active) setRecords(data);
    }).catch((problem) => {
      if (active) setError(problem.message);
    });
    return () => { active = false; };
  }, [api, paths]);

  async function change(path, options, message, afterSave) {
    setBusy(true);
    setError('');
    setSuccess('');
    try {
      await api(path, options);
      afterSave();
      setSuccess(message);
      try {
        setRecords(await loadRecords());
      } catch (problem) {
        setError(message + ' Refresh the page to see the latest list. ' + problem.message);
      }
    } catch (problem) {
      setError(problem.message);
    } finally {
      setBusy(false);
    }
  }

  return { records, error, success, busy, change };
}

export function AdminPage({ api, paths, endpoint, title, messages, renderEditor, renderList }) {
  const state = useRecords(api, paths);
  const [selected, setSelected] = useState(null);
  const [formVersion, setFormVersion] = useState(0);

  function resetForm() {
    setSelected(null);
    setFormVersion((value) => value + 1);
  }

  function save(body) {
    const path = selected ? endpoint + '/' + selected.id : endpoint;
    const message = selected ? messages.updated : messages.created;
    return state.change(path, { method: selected ? 'PUT' : 'POST', body }, message, resetForm);
  }

  function remove(row, prompt) {
    if (!window.confirm(prompt)) return;
    state.change(endpoint + '/' + row.id, { method: 'DELETE' }, messages.deleted, () => {
      if (selected?.id === row.id) resetForm();
    });
  }

  return <>
    <h1>{title}</h1>
    <Notice error={state.error} success={state.success} />
    {state.records ? <div className="management">
      {renderEditor({
        key: formVersion,
        selected,
        busy: state.busy,
        onSave: save,
        onCancel: resetForm
      }, state.records)}
      {renderList(state.records[0], {
        onEdit: (row) => {
          setSelected(row);
          setFormVersion((value) => value + 1);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        },
        remove,
        busy: state.busy
      })}
    </div> : !state.error && <p role="status">Loading…</p>}
  </>;
}
