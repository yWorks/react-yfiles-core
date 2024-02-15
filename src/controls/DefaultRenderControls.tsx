import { RenderControlsProps } from './Controls.tsx'
import { combineCssClasses } from '../utils/combine-css-classes.ts'

/**
 * The default rendering for the {@link Controls} component.
 */
export function DefaultRenderControls({ buttons, orientation }: RenderControlsProps) {
  const separatorClass = combineCssClasses([
    'yfiles-react-controls__separator',
    `yfiles-react-controls__separator--${orientation}`
  ])
  const buttonContainerClass = combineCssClasses([
    'yfiles-react-controls__button-container',
    `yfiles-react-controls__button-container--${orientation}`
  ])
  return buttons.length > 0
    ? buttons.map((button, i) => {
        return (
          <div key={`sep-${i}`} className={buttonContainerClass}>
            <button
              className={`yfiles-react-controls__button ${button.className || ''}`}
              onClick={button.action}
              disabled={button.disabled}
              key={`b-${i}`}
              title={button.tooltip!}
            >
              {typeof button.icon === 'string' ? (
                <img
                  className="yfiles-react-controls__button-img"
                  src={button.icon}
                  alt={button.tooltip}
                />
              ) : (
                button.icon
              )}
            </button>
            {i < buttons.length - 1 && <div className={separatorClass}></div>}
          </div>
        )
      })
    : null
}
