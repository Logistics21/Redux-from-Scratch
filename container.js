HOC = connect(mapStateToPops, mapDispatchToProps)

Container = HOC(wrappedComponent)

export function connect(
  mapStateToPops,
  mapDispatchToProps
) {

  return connectHOC(mapStateToPops, mapDispatchToProps)
}
