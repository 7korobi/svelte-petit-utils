<script lang="ts">
	import { table, __BROWSER__ } from '$lib';

	type A = { _id: number; name: string; b?: B; b_id?: number; c_id?: number };
	type B = {
		_id: number;
		name: string;
		parent_id?: number;
	};
	type C = { _id: number; name: string };

	const A = table<A>(({ _id }) => `${_id}`, [{ _id: 1, name: 'いち', b_id: 2, c_id: 4 }]);

	const B = table<B>(
		({ _id }) => `${_id}`,
		[
			{ _id: 2, name: 'に', parent_id: 3 },
			{ _id: 3, name: 'さん' }
		]
	);

	const C = table<C>(({ _id }) => `${_id}`, [{ _id: 4, name: 'よん' }]);

	/*
	const asOfC = C.hasMany(A, (a)=> [a.c_id], (c)=> c._id).order((a)=> a._id)
	const asOfB = B.hasMany(A, (a)=> [a.b_id], (b)=> b._id).order((a)=> a._id)

	const cByA = asOfC.belongsTo
	const bByA = asOfB.belongsTo

	const bsOfC = A.through(bByA, aOfC)
	const csOfB = A.through(cByA, aOfB)
	const children = B.hasMany(B, (b)=> [B.parent_id], (b)=> b._id)

	$cByA(a)
	$asOfC(c)
	$bsOfC(c)

	$bByA(a)
	$asOfB(b)
	$csOfB(b)

	$children(b)

	// Role has many Card
	const cardsByRole = roles.hasMany(cards, (c)=> c.role_id) // role.id is finder
	const cardsByUser = users.hasMany(cards, (c)=> c.user_id) // user.id is finder
	const [rolesByUser, usersByRole] = cards.through(cardsByRole, cardsByUser)

	cardsByUser(user)
	rolesByUser(user)
	usersByRole(role)

	for(const role of $roles) {
		$cardsByRole(role) // card.role_id === role.id
	}
	for(const user of $users) {

	}

	for(const c of $C) {
		asOfC(c,$A)
		c.as($A)
		$A.(c)
	}
	for(const b of $B) {
		bsOfC(b,$A)
		b.as($A)
		$A.with(b)
	}
	for(const b of $B) {
		parent(b)
		children(b)
		b.parent($B)
		b.children($B)
		$B.parentOf(b)
		$B.childrenOf(b)
	}

	A.belongsTo(
		// foreign[key] = [{},{}]
		// A#children.push(    !B.add; key = arg2(a); [as, bs] = foreign[key]; as[A#finder(a)] = a; as{ arg4(a, bs, a_id, b_ids) }; ! arg5 )
		// B#children.push( A.add([]); key = arg3(b); [as, bs] = foreign[key]; bs[B#finder(b)] = b; as{ arg4(a, bs, a_id, b_ids) }; ! arg5 )
		B,
		(a) => a.b_id,
		(b) => b._id,
		'b'
	);
	B.hasMany(
		// foreign[key] = [{},{}]
		// A#children.push( B.add([]); key = arg2(a); [as, bs] = foreign[key]; as[A#finder(a)] = a; as{ arg4(a, bs, a_id, b_ids) }; ! arg5 )
		// B#children.push( A.add([]); key = arg3(b); [as, bs] = foreign[key]; bs[B#finder(b)] = b; as{ arg4(a, bs, a_id, b_ids) }; bs{ arg5(as, b, a_ids, b_id) })
		A,
		(a) => a.b_id,
		(b) => b._id,
		'b',
		'as'
	);

	A.belongsTo(
		// foreign[key] = [{},{}]
		// A#children.push(    !C.add; key = arg2(a); [as, cs] = foreign[key]; as[A#finder(a)] = a; as{ arg4(a, cs, a_id, c_ids) }; ! arg5 )
		// C#children.push( A.add([]); key = arg3(c); [as, cs] = foreign[key]; cs[C#finder(c)] = c; as{ arg4(a, cs, a_id, c_ids) }; ! arg5 )
		C,
		(a) => a.c_id,
		(c) => c._id,
		'c'
	);
	C.hasMany(
		// foreign[key] = [{},{}]
		// A#children.push( C.add([]); key = arg2(a); [as, cs] = foreign[key]; as[A#finder(a)] = a; as{ arg4(a, cs, a_id, c_ids) }; ! arg5 )
		// C#children.push( A.add([]); key = arg3(c); [as, cs] = foreign[key]; cs[C#finder(b)] = c; as{ arg4(a, cs, a_id, c_ids) }; cs{ arg5(as, c, a_ids, c_id) })
		A,
		(a) => a.c_id,
		(c) => c._id,
		'c',
		'as'
	);

	B.belongsTo(
		// foreign[key] = [{},{}]
		// B#children.push( !B.add; key = arg2(b1); [b1s, b2s] = foreign[key]; b1s[B#finder(b1)] = b1; b1s{ arg4(b, b2s, b_id, b2_ids) }; ! arg5 )
		// B#children.push( !B.add; key = arg3(b2); [b1s, b2s] = foreign[key]; b2s[B#finder(b2)] = b2; b1s{ arg4(b, b2s, b_id, b2_ids) }; ! arg5 )
		B,
		(b1) => b1.parent_id,
		(b2) => b2._id,
		'parent'
	);
	B.hasMany(
		// foreign[key] = [{},{}]
		// B#children.push( !B.add; key = arg2(b1); [b1s, b2s] = foreign[key]; b1s[B#finder(b1)] = b1; b1s{ arg4(b, b2s, b_id, b2_ids) }; ! arg5 )
		// B#children.push( !B.add; key = arg3(b2); [b1s, b2s] = foreign[key]; b2s[B#finder(b2)] = b2; b1s{ arg4(b, b2s, b_id, b2_ids) }; ! arg5 )
		B,
		(b1) => b1.parent_id,
		(b2) => b2._id,
		'parent',
		'children'
	);

	A.through(
		// B#children.push( A.add([]); C.add([]); arg3(b) )
		// C#children.push( A.add([]); B.add([]); arg4(c) )
		B,
		C,
		'cs'
		(b) => (b.as?.map((a) => a.c!)),
		'bs',
		(c) => (c.as?.map((a) => a.b))
	);
*/

	const namesBase = table(
		(o) => `${o.id}`,
		[
			{ id: 1, name: 'イチ', created_at: new Date() },
			{ id: 2, name: 'ニ', created_at: new Date() },
			{ id: 3, name: 'サン', created_at: new Date() },
			{ id: 4, name: 'シ', created_at: new Date() }
		]
	);
	namesBase.add([{ id: 10, name: 'トオ', created_at: new Date() }]);

	//	const namesBaseCount = namesBase.reduce((o, id, { MAX, MIN, SUM, COUNT }) => ({ ...COUNT(), ...SUM(o.id) }));
	let id = 100;
	__BROWSER__ &&
		setInterval(() => {
			id++;
		}, 1);
	let names = namesBase.toReader();
	$: namesBase.add([{ id: id % 100, name: `name-${id}`, created_at: new Date() }]);

	$: namesCount = names.reduce((o, id, { GROUP, COUNT, QUANTILE, VARIANCE }) => ({
		...QUANTILE('min', 'med', 'max')(o.id),
		...VARIANCE(o.id - 0),
		...GROUP(`size`, () => GROUP(`is ${o.name.length}`, COUNT))
	}));
</script>

<h1>Welcome to your library project</h1>
<p>Create your package using @sveltejs/package and preview/showcase your work with SvelteKit</p>
<p>Visit <a href="https://kit.svelte.dev">kit.svelte.dev</a> to read the documentation</p>

<button
	on:click={() => {
		names = names.order((o) => o.id);
	}}>order to id</button
>
<button
	on:click={() => {
		names = names.order((o) => o.name);
	}}>order to name</button
>
<button
	on:click={() => {
		names = names.order((o) => [o.name?.length, o.id]);
	}}>order to name.length</button
>
<button
	on:click={() => {
		names = names.where((o) => 0 === o.id % 2).shuffle();
	}}>shuffle</button
>

<button
	on:click={() => {
		id++;
	}}>add</button
>

<p>
	{names.find('10')?.id} : {names.find('10')?.name}
</p>

<p>
	{@html JSON.stringify($namesCount).replaceAll(',', '<br/>,')}
</p>

<p>where = {$names.where}</p>
<p>order = {$names.order}</p>
<p>desc = {$names.orderType}</p>

<p>A : {JSON.stringify($A)}</p>
<p>B : {JSON.stringify($B)}</p>
<p>C : {JSON.stringify($C)}</p>

{#each $names as item (item.id)}
	<p>
		{item.id} : {item.name}
	</p>
{/each}
