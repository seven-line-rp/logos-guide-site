import { Component } from 'react'
import { RotateCw } from 'lucide-react'
import { classify, reportError } from '../error-report.js'

// Если раздел упал при отрисовке, вместо белого экрана человек видит понятное
// сообщение и кнопку «Обновить». Сбой уходит в оповещения (error-report.js).
export default class ErrorBoundary extends Component {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error) {
    reportError(classify(error?.message) === 'chunk' ? 'chunk' : 'react', error)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return <section className="not-found container" role="alert"><span className="eyebrow">Что-то пошло не так</span><h1>Раздел не открылся.<br /><em>Попробуйте обновить.</em></h1><p>Возможно, сайт только что обновился или пропала связь. Обычно помогает перезагрузка страницы. Если не помогло, напишите нам через «Сообщить о проблеме».</p><div><button className="button button-primary" type="button" onClick={() => window.location.reload()}><RotateCw size={15} /> Обновить страницу</button><a href="/">На главную</a></div></section>
  }
}
