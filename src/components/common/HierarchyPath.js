import React from 'react';

export default function HierarchyPath({ path }) {
  return <bdi dir="ltr" className="break-all">{(path || '').split('/').map((part, index) =>
    <React.Fragment key={index}>{index > 0 && '/'}<bdi dir="auto">{part}</bdi></React.Fragment>
  )}</bdi>;
}
