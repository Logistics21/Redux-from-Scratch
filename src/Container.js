import PropTypes from 'prop-types';

const storeShape = PropTypes.shape({
  subscribe: PropTypes.func.isRequired,
  dispatch: PropTypes.func.isRequired,
  getState: PropTypes.func.isRequired
})

const subscriptionShape = PropTypes.shape({
  trySubscribe: PropTypes.func.isRequired,
  notifyNestedSubs: PropTypes.func.isRequired
})

class Provider extends React.Component {
  constructor(props, context) {
    super(props, context);
    this.store = props.store;
  }


  getChildContext() {
    return { store: this.store, parentSub: null }
  }

  render() {
    return React.Children.only(this.props.children)
  }
}

Provider.childContextTypes = {
  store: storeShape,
  parentSub: subscriptionShape
}


HOC = connect(mapStateToPops, mapDispatchToProps)

Container = HOC(wrappedComponent)

export function connect(
  mapStateToPops,
  mapDispatchToProps
) {

  return connectHOC(mapStateToPops, mapDispatchToProps)
}

function connectHOC(
  mapStateToPops, mapDispatchToProps) {

  return function wrapWithConnect(WrappedComponent) {

    class Connect extends Component {
      constructor(props, context) {
        super(props, context)
        this.store = context.store;

        const parentSub = this.context.parentSub;

        this.subscription = new Subscription(this.store, parentSub, this.onStateChange.bind(this))
      }

      getChildContext() {
        return {
          parentSub: this.subscription;
        }
      }

      componentDidMount() {
        this.subscription.trySubscribe();
        // store.subscribe(this.onStateChange.bind(this))
      }

      onStateChange() {
        this.setState({})
      }

      componentDidUpdate() {
        this.subscription.notifyNestedSubs();
      }

      render() {
        const mergedProps = stateAndDispatchMerge();

        return React.createElement(WrappedComponent, mergedProps)
      }
    }

    Connect.contextTypes = {
      store: storeShape,
      parentSub: subscriptionShape,
    }

    Connect.childContextTypes = {
      parentSub: subscriptionShape,
    }

    return Connect;
  }
}

// version 1
// function connectHOC(
//   mapStateToPops, mapDispatchToProps) {
//
//   return function wrapWithConnect(WrappedComponent) {
//
//     class Connect extends Component {
//       componentDidMount() {
//         store.subscribe(this.onStateChange.bind(this))
//       }
//
//       onStateChange() {
//         this.setState({})
//       }
//
//       render() {
//         const mergedProps = stateAndDispatchMerge();
//
//         return React.createElement(WrappedComponent, mergedProps)
//       }
//     }
//
//     return Connect;
//   }
// }
