import './LicenseError.css'

export interface LicenseErrorProps {
  componentName: string
  codeSample: string
}

export function LicenseError(props: LicenseErrorProps) {
  return (
    <>
      <div className="yfiles-react-license-error">
        <div className="yfiles-react-license-error-dialog">
          <div className="yfiles-react-license-error-dialog__title">Invalid / Missing License</div>
          <div className="yfiles-react-license-error-dialog__content">
            <div className="yfiles-react-license-error-dialog__paragraph">
              The <em>{props.componentName}</em> requires a valid{' '}
              <a href="https://www.yworks.com/products/yfiles-for-html">yFiles for HTML</a> license.
            </div>
            <div className="yfiles-react-license-error-dialog__paragraph">
              You can evaluate yFiles for 60 days free of charge on{' '}
              <a href="https://my.yworks.com/signup?product=YFILES_HTML_EVAL">my.yworks.com</a>.
            </div>

            <div className="yfiles-react-license-error-dialog__paragraph">
              Add the <code>license.json</code> to your React application and register it before
              using the component.
            </div>

            <div className="yfiles-react-license-error-dialog__code-snippet">
              <pre>{props.codeSample}</pre>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
