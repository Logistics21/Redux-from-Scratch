HOC = connect(mapStateToPops, mapDispatchToProps)

Container = HOC(wrappedComponent)

export function connect(
  mapStateToPops,
  mapDispatchToProps
) {

  return connectHOC(mapStateToPops, mapDispatchToProps)
}

function connectHOC(mapStateToPops, mapDispatchToProps) {

  return function wrapWithConnect(WrappedComponent) {

    class Connect extends Component {
      componentDidMount() {
        store.subscribe(this.onStateChange.bind(this))
      }
    }
  }
}
