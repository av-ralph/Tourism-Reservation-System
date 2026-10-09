import { Fragment } from 'react'

// Keep the college's red lowercase e consistent in names and document text.
export default function CollegeText({ children }) {
  return String(children).split(/(Cristal e-College)/gi).map((part, index) =>
    /^Cristal e-College$/i.test(part)
      ? <Fragment key={index}>{part.slice(0, 8)}<span className="college-red-e">e</span>{part.slice(9)}</Fragment>
      : part
  )
}
