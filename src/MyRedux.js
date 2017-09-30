import React from 'react';
import PropTypes from 'prop-types';

// it seems like components should subscribe to the store during componentDidMount
// but in react descendant components mount before ancestors store notifications will
// trigger a re-render of descendants before ancestors breaking unidirectional flow

// the storeShape object's propTypes have 3 functions
const storeShape = PropTypes.shape({
  subscribe: PropTypes.func.isRequired,
  dispatch: PropTypes.func.isRequired,
  getState: PropTypes.func.isRequired
})

// instead each container component maintains its own subscription and notification
// system, thus the doesn't notify every container, but every container notifies the
// children below it


const subscriptionShape = PropTypes.shape({
  trySubscribe: PropTypes.func.isRequired,
  notifyNestedSubs: PropTypes.func.isRequired
})

// This component exposes a context for the child components to access the redux store
// besides the store object Provide also provides another context variable called parentSub
// parentSub references to the Subscription instance of the ancetor container (initially null)
class Provider extends React.Component {
  constructor(props, context) {
    super(props, context);
    this.store = props.store;
  }

  // React method that is called when state or props change
  getChildContext() {
    return { store: this.store, parentSub: null }
  }

  render() {
    return React.Children.only(this.props.children)
  }
}

// the parentSub context variable gets updated when it's passed down
Provider.childContextTypes = {
  store: storeShape,
  parentSub: subscriptionShape
}

// Redux's connect function is a higher order function that returns a higher order component
// this high order component will then return the container component
HOC = connect(mapStateToProps, mapDispatchToProps)

// the container component is aware of the redux store and will inject props
// derived from a mapping function into the wrapped presentational Component
// these mapping functions are known as mapState & DispatchToProps respectively
Container = HOC(wrappedComponent)

export function connect(
  mapStateToProps,
  mapDispatchToProps
) {
  // connectHOC is the function that return the higher order component connected to the store
  return connectHOC(mapStateToProps, mapDispatchToProps)
}

function connectHOC(mapStateToProps, mapDispatchToProps) {

  // wrapWithConnect is the higher order Component
  return function wrapWithConnect(WrappedComponent) {

    // Connect is the container component that returns the presentational component
    // originally it had two main functions, now it has 2 more
    // 1.) it subscribes to the store with the callback onStateChange
    // when onStateChange is called it calls setState with a dummy object
    // 2.) it calls mSTP and mDTP functions to get the mergedProps to be injected into
    // the wrapped component
    // 3.) in the constructor is uses parentSub to configure its own subscription
    // 4.) in getChildContext it replaces the parent subscription with it's own so
    // its children can get access to it
    class Connect extends React.Component {
      constructor(props, context) {
        super(props, context)
        this.store = context.store;

        // get parents' Subscription instance from context
        const parentSub = this.context.parentSub;

        //init own Subscription instance based on parents' Subscription
        this.subscription = new Subscription(this.store, parentSub, this.onStateChange.bind(this))
      }

      getChildContext() {
        // replace parentSub context for child component w/ own Subscription instance
        return { parentSub: this.subscription }
      }

      componentDidMount() {
        this.subscription.trySubscribe();
      }

      onStateChange() {
        // setState should be used over forceUpdate as it checks shouldComponentUpdate
        // which prevents unnesccesary re-render
        this.setState({})
      }

      componentDidUpdate() {
        //after the current component get updated, please notify the nested subscription
        this.subscription.notifyNestedSubs();
      }

      render() {
        //container's true job is to inject mergedProps into the WrappedComponent
        const mergedProps = stateAndDispatchMerge();

        return React.createElement(WrappedComponent, mergedProps)
      }
    }

    // the context exposed to the Connect container itself
    Connect.contextTypes = {
      store: storeShape,
      parentSub: subscriptionShape,
    }

    // replace the context of parentSub for the child component
    Connect.childContextTypes = {
      parentSub: subscriptionShape,
    }

    return Connect;
  }
}

// version 1
// function connectHOC(
//   mapStateToProps, mapDispatchToProps) {
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
