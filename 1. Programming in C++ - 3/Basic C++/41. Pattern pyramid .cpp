#include<iostream>
using namespace std;
int main()
{
    char n='*';
    char  a=' ';
    int times;
    int i,j,k;
    cin>>times;

    for(i=1; i<=times; i++)
    {
        for ( j=times-1; j>=i ; j--)
        {
            cout<<a;
        }

        for(k=0; k<i ; k++)
        {
         if(k==i-1)
         {
             cout<<n;
         }
         else
         {
             cout<<n<<a;
         }
        }
        cout<<endl;
    }
}

