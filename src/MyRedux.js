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


// <Provider>
//   <Container1>
//     <Container2 />
//   </Container1>
// </Provider>

// in the above example Container2 mounts first, triggering trySubscribe
// this method tries to subscribe the callback func (onStateChange) to its
// parent's (Container1) subscription by calling addNestedSub. in addNestedSub
// the subscription of Container1 will first call its own trySubscribe
// however since the root container does not have an ancestor its parentSub will
// initialize to null from the Provider, thus it will subscribe its own onStateChange
// to the store directly. This recursive process ensures that only the onStateChange
// callback of the root container subscribes to the store and the following onStateChange
// will subscribe to the parentSub of each component
// this provides a bottom up subscription method and top down notification system
class Subscription {
  constructor(store, parentSub, onStateChange) {
    this.store = store;                   //global store from context
    this.parentSub = parentSub;           //parentSub from context
    this.onStateChange = onStateChange;   //its own listener
    this.subscribed = false;              //flag for testing if it has subscribed
    this.listeners = [];                  // nested subscription listeners subscribe here
  }

  // defined in subscriptionShape
  notifyNestedSubs() {
    this.listeners.forEach(listener => listener())
  }

  trySubscribe() {
    //if not yet subscribed
    if (!this.subscribed) {
      if (this.parentSub !== null) {
        // if has parentSub (from context), subscribe to parentSub
        this.parentSub.addNestedSub(this.onStateChange);
      }
    } else {
      // if root component just subscribe directly to store
      this.store.subscribe(this.onStateChange);
    }

    this.subscribed = true;
  }

  // add nested subscription to itself
  addNestedSub(listener) {
    // MUST make sure it is subscribed, or order can't be maintained
    this.trySubscribe() {
      // found in subscriptionShape

      // Now subscribe the nested listener to it Subscription's own listener collection
      this.listeners.push(listener);
    }
  }
}


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



// a selector is a function that selects props from source data including store.state
// and store.dispatch

function simpleSelector(nextState, nextOwnProps) {
  var stateProps = mapStateToProps(nextState, nextOwnProps)
  var dispatchProps = mapDispatchToProps(dispatch, nextOwnProps)

  var mergedProps = {
    ...stateProps,
    ...dispatchProps,
    ...nextOwnProps,
  }

  return mergedProps;
}

// the above selector works with the Connect component but every time the container
// receives new props from its parent or when onStateChange is triggered it will call
// the selector and run the mapping function to recalculate state and dispatch props
// and since every run returns a new mergedProps object (with the object spread syntax)
// there is no easy way to determine when to re-render


// the mapping function is unoptimized and can be changed in two ways
// 1.) memoize selector with a factory function to provide scope for caching the last
// input and output t0 be compared to last input using shallowEqual and strict equal
// if current input is both then just return previous output
//
// 2.) make the selector stateful
// because the only source of truth for the wrappedComponentis mergedProps calculated
// by the selector, and the selector has full control over the mergedProps you can
// assign shouldComponentUpdate checking to the selector itself

function makeStatefulSelector(selector, store) {
  //wrap the selector in an object that tracks its results between runs

  const statefulSelector = {
    run: function (props) {
      const nextProps = selector(store.getState(), props);
      // but it sets shouldComponentUpdate to true if it is different from previous one
      if (nextProps !== statefulSelector.props) {
        //update info for React
        statefulSelector.shouldComponentUpdate = true;
        statefulSelector.props = nextProps;
      }
    }
  }

  return statefulSelector;
}


// at the top is makeStatefulSelector which wraps the original selector function and tracks
// its result between runs and it has a flag shouldComponentUpdate which will be used in the
// actual React lifecycle method to determine if re-render is necessary

// the other job of the container component is to inject props into the wrappedComponent
//these props are generated one of three ways.
// 1.) ownProps, its own props received as JSX <Container prop1={abc} prop2={def} />
// 2.) stateProps derived from mapStateToProps with store.state
// 3.) DispatchProps derived from mapDispatchToProps with store.dispatch
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
        this.initSelector();


        // get parents' Subscription instance from context
        const parentSub = this.context.parentSub;

        //init own Subscription instance based on parents' Subscription
        this.subscription = new Subscription(this.store, parentSub, this.onStateChange.bind(this))
      }

      initSelector() {
        // selector: { reduxStore.state + ownProps } => injected mergedProps
        // this.selector = simpleSelector;
        const selector = selectorFactory(this.store.dispatch, mapStateToProps, mapDispatchToProps)
        this.selector = makeStatefulSelector(selector, this.store);
        // init the mergedProps for initial render
        this.selector.run(this.props);
      }

      getChildContext() {
        // replace parentSub context for child component w/ own Subscription instance
        return { parentSub: this.subscription }
      }

      componentDidMount() {
        this.subscription.trySubscribe();
      }

      // when oSC gets called it resets itself, then uses its own subscription to notify
      // nested subscriptions by calling notifyNestedSubs
      // this is how it maintains the order of notification

      // onStateChange => setState => componentDidUpdate => notifyNestedSubs => recursively
      // updates the descendants' stores by calling their onStateChange

      // data source 1: store state change
      onStateChange() {
        // this.selectorProps = this.selector(store.state, nextProps)
        // line above replaced
        this.selector.run(this.props);
        if (!this.selector.shouldComponentUpdate) {
          // if it does not get a re-render, we still need to notify the nested subscription
          this.subscription.notifyNestedSubs();
        } else {
          this.componentDidUpdate.this.notifyNestedSubsOnComponentDidUpdate;
          this.setState({})


          // setState should be used over forceUpdate as it checks shouldComponentUpdate
          // which prevents unnesccesary re-render
          //setState moved into if else
        }
      }

      notifyNestedSubsOnComponentDidUpdate() {
        this.componentDidUpdate = undefined; // umimplement it to avoid notification due to
        // normal update(e.g. parent's re-render)
        this.subscription.notifyNestedSubs();
      }

      // data source 2: ownProps change
      componentWillReceiveProps(nextProps) {
        this.selectorProps = this.selector(store.state, nextProps)
      }

      shouldComponentUpdate() {
        //rely on stateful selector, prevent unnesccesary re-render
        return this.selector.shouldComponentUpdate;
      }

      componentDidUpdate() {
        //after the current component get updated, please notify the nested subscription
        this.subscription.notifyNestedSubs();
      }

      render() {
        const selector = this.selector;
        selector.shouldComponentUpdate = false; // reset the flag of selector
        //container's true job is to inject mergedProps into the WrappedComponent
        // replaced with this.selectorProps
        // const mergedProps = stateAndDispatchMerge();

        return React.createElement(WrappedComponent, this.selectorProps)
        // get mergedProps from selector
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


// version 2
// // it seems like components should subscribe to the store during componentDidMount
// // but in react descendant components mount before ancestors store notifications will
// // trigger a re-render of descendants before ancestors breaking unidirectional flow
//
// // the storeShape object's propTypes have 3 functions
// const storeShape = PropTypes.shape({
//   subscribe: PropTypes.func.isRequired,
//   dispatch: PropTypes.func.isRequired,
//   getState: PropTypes.func.isRequired
// })
//
//
// // instead each container component maintains its own subscription and notification
// // system, thus the doesn't notify every container, but every container notifies the
// // children below it
// const subscriptionShape = PropTypes.shape({
//   trySubscribe: PropTypes.func.isRequired,
//   notifyNestedSubs: PropTypes.func.isRequired
// })
//
//
// // <Provider>
// //   <Container1>
// //     <Container2 />
// //   </Container1>
// // </Provider>
//
// // in the above example Container2 mounts first, triggering trySubscribe
// // this method tries to subscribe the callback func (onStateChange) to its
// // parent's (Container1) subscription by calling addNestedSub. in addNestedSub
// // the subscription of Container1 will first call its own trySubscribe
// // however since the root container does not have an ancestor its parentSub will
// // initialize to null from the Provider, thus it will subscribe its own onStateChange
// // to the store directly. This recursive process ensures that only the onStateChange
// // callback of the root container subscribes to the store and the following onStateChange
// // will subscribe to the parentSub of each component
// // this provides a bottom up subscription method and top down notification system
// class Subscription {
//   constructor(store, parentSub, onStateChange) {
//     this.store = store;                   //global store from context
//     this.parentSub = parentSub;           //parentSub from context
//     this.onStateChange = onStateChange;   //its own listener
//     this.subscribed = false;              //flag for testing if it has subscribed
//     this.listeners = [];                  // nested subscription listeners subscribe here
//   }
//
//   // defined in subscriptionShape
//   notifyNestedSubs() {
//     this.listeners.forEach(listener => listener())
//   }
//
//   trySubscribe() {
//     //if not yet subscribed
//     if (!this.subscribed) {
//       if (this.parentSub !== null) {
//         // if has parentSub (from context), subscribe to parentSub
//         this.parentSub.addNestedSub(this.onStateChange);
//       }
//     } else {
//       // if root component just subscribe directly to store
//       this.store.subscribe(this.onStateChange);
//     }
//
//     this.subscribed = true;
//   }
//
//   // add nested subscription to itself
//   addNestedSub(listener) {
//     // MUST make sure it is subscribed, or order can't be maintained
//     this.trySubscribe() {
//       // found in subscriptionShape
//
//       // Now subscribe the nested listener to it Subscription's own listener collection
//       this.listeners.push(listener);
//     }
//   }
// }
//
//
// // This component exposes a context for the child components to access the redux store
// // besides the store object Provide also provides another context variable called parentSub
// // parentSub references to the Subscription instance of the ancetor container (initially null)
// class Provider extends React.Component {
//   constructor(props, context) {
//     super(props, context);
//     this.store = props.store;
//   }
//
//   // React method that is called when state or props change
//   getChildContext() {
//     return { store: this.store, parentSub: null }
//   }
//
//   render() {
//     return React.Children.only(this.props.children)
//   }
// }
//
// // the parentSub context variable gets updated when it's passed down
// Provider.childContextTypes = {
//   store: storeShape,
//   parentSub: subscriptionShape
// }
//
// // Redux's connect function is a higher order function that returns a higher order component
// // this high order component will then return the container component
// HOC = connect(mapStateToProps, mapDispatchToProps)
//
// // the container component is aware of the redux store and will inject props
// // derived from a mapping function into the wrapped presentational Component
// // these mapping functions are known as mapState & DispatchToProps respectively
// Container = HOC(wrappedComponent)
//
//
// // the other job of the container component is to inject props into the wrappedComponent
// //these props are generated one of three ways.
// // 1.) ownProps, its own props received as JSX <Container prop1={abc} prop2={def} />
// // 2.) stateProps derived from mapStateToProps with store.state
// // 3.) DispatchProps derived from mapDispatchToProps with store.dispatch
//
// // a selector is a function that selects props from source data including store.state
// // and store.dispatch
// export function connect(
//   mapStateToProps,
//   mapDispatchToProps
// ) {
//   // connectHOC is the function that return the higher order component connected to the store
//   return connectHOC(mapStateToProps, mapDispatchToProps)
// }
//
// function connectHOC(mapStateToProps, mapDispatchToProps) {
//
//   // wrapWithConnect is the higher order Component
//   return function wrapWithConnect(WrappedComponent) {
//
//     // Connect is the container component that returns the presentational component
//     // originally it had two main functions, now it has 2 more
//     // 1.) it subscribes to the store with the callback onStateChange
//     // when onStateChange is called it calls setState with a dummy object
//     // 2.) it calls mSTP and mDTP functions to get the mergedProps to be injected into
//     // the wrapped component
//     // 3.) in the constructor is uses parentSub to configure its own subscription
//     // 4.) in getChildContext it replaces the parent subscription with it's own so
//     // its children can get access to it
//     class Connect extends React.Component {
//       constructor(props, context) {
//         super(props, context)
//         this.store = context.store;
//
//         // get parents' Subscription instance from context
//         const parentSub = this.context.parentSub;
//
//         //init own Subscription instance based on parents' Subscription
//         this.subscription = new Subscription(this.store, parentSub, this.onStateChange.bind(this))
//       }
//
//       getChildContext() {
//         // replace parentSub context for child component w/ own Subscription instance
//         return { parentSub: this.subscription }
//       }
//
//       componentDidMount() {
//         this.subscription.trySubscribe();
//       }
//
//       // when oSC gets called it resets itself, then uses its own subscription to notify
//       // nested subscriptions by calling notifyNestedSubs
//       // this is how it maintains the order of notification
//
//       // onStateChange => setState => componentDidUpdate => notifyNestedSubs => recursively
//       // updates the descendants' stores by calling their onStateChange
//       onStateChange() {
//         // setState should be used over forceUpdate as it checks shouldComponentUpdate
//         // which prevents unnesccesary re-render
//         this.setState({})
//       }
//
//       componentDidUpdate() {
//         //after the current component get updated, please notify the nested subscription
//         this.subscription.notifyNestedSubs();
//       }
//
//       render() {
//         //container's true job is to inject mergedProps into the WrappedComponent
//         const mergedProps = stateAndDispatchMerge();
//
//         return React.createElement(WrappedComponent, mergedProps)
//       }
//     }
//
//     // the context exposed to the Connect container itself
//     Connect.contextTypes = {
//       store: storeShape,
//       parentSub: subscriptionShape,
//     }
//
//     // replace the context of parentSub for the child component
//     Connect.childContextTypes = {
//       parentSub: subscriptionShape,
//     }
//
//     return Connect;
//   }
// }

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
