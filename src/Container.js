import React, { PropTypes } from 'react';

const storeShape = PropTypes.shape({
  subscribe: PropTypes.func.isRequired,
  dispatch: PropTypes.func.isRequired,
  getState: PropTypes.func.isRequired
})

const subscriptionShape = PropTypes.shape({
  trySubscribe: PropTypes.func.isRequired,
  notifyNestedSubs: PropTypes.func.isRequired
})


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

      onStateChange() {
        this.setState({})
      }

      render() {
        const mergedProps = stateAndDispatchMerge();

        return React.createElement(WrappedComponent, mergedProps)
      }
    }

    return Connect;
  }
}
