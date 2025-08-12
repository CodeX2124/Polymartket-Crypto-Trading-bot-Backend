import { NextResponse } from 'next/server';
import { getDatabase } from '../config/db'

export async function POST(req: Request) {
    try {
      const db = await getDatabase();
      const account = await req.json();
  
      // Validate input
      if (!account.id || !account.proxyWallet || !account.privateKey) {
        return NextResponse.json(
          { error: 'Missing required fields' },
          { status: 400 }
        );
      }
  
      // Insert new account
      const result = await db.collection('accounts').insertOne(account);
      return NextResponse.json({ 
        ...account, 
        _id: result.insertedId 
      });
  
    } catch (error: any) {
      if (error.code === 11000) {
        return NextResponse.json(
          { error: 'Account with this ID already exists' },
          { status: 400 }
        );
      }
      return NextResponse.json(
        { error: 'Internal server error' },
        { status: 500 }
      );
    }
  }

export async function GET() {
  try {
    const db = await getDatabase();
    const accounts = await db.collection('accounts').find().toArray();
    return NextResponse.json(accounts);
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch accounts' },
      { status: 500 }
    );
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const db = await getDatabase();

    const result = await db.collection('accounts').deleteOne({ id });
    if (result.deletedCount === 0) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const { isActive } = await req.json();
    const db = await getDatabase();

    const result = await db.collection('accounts').updateOne(
      { id },
      { $set: { isActive } }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json(
        { error: 'Account not found' },
        { status: 404 }
      );
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update account' },
      { status: 500 }
    );
  }
}