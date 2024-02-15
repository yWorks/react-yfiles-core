import './LicenseError.css'

export function LicenseError() {
  return (
    <>
      <div className="yfiles-react-license-error">
        <div className="yfiles-react-license-error-dialog">
          <div className="yfiles-react-license-error-dialog__title">Invalid / Missing License</div>
          <div className="yfiles-react-license-error-dialog__content">
            <div className="yfiles-react-license-error-dialog__paragraph">
              The <em>yFiles React Organization Chart Component</em> requires a valid{' '}
              <a href="https://www.yworks.com/products/yfiles-for-html">yFiles for HTML</a> license.
            </div>
            <div className="yfiles-react-license-error-dialog__paragraph">
              You can evaluate yFiles for 60 days free of charge on{' '}
              <a href="https://my.yworks.com/signup?product=YFILES_HTML_EVAL">my.yworks.com</a>.
            </div>

            <div className="yfiles-react-license-error-dialog__paragraph">
              Add the <code>license.json</code> to your React application and register it like this:
            </div>

            <div className="yfiles-react-license-error-dialog__code-snippet">
              <pre>
                {`import {OrgChart, registerLicense} from '@yworks/react-yfiles-orgchart' 
import '@yworks/react-yfiles-orgchart/dist/index.css'
import yFilesLicense from './license.json'

function App() {
  registerLicense(yFilesLicense)
            
  const data = [
    {id: 0, name: 'Eric Joplin', subordinates: [1, 2]},
    {id: 1, name: 'Amy Kain'},
    {id: 2, name: 'David Kerry'}
  ]

  return <OrgChart data={data}></OrgChart>
}`}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
