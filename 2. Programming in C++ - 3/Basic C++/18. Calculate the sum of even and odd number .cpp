#include <iostream>
using namespace std;
int main()
{
    int n, i,even=0 ,odd=0;

    cout<<"Enter a number = ";
    cin>>n;
    for(i=1 ; i<=n ; i++)
    {
        if( i%2==0)
        {
            even= even+i;
        }else if (i%2 !=0)
        {
            odd=odd + i;
        }
    }
    cout<<endl<<"Total Even number of 1 to "<<n<<"is ="<< even;
     cout<<endl<<"Total Odd number of 1 to "<<n<<"is ="<< odd;
}
