  //Prime series
#include <iostream>
using namespace std;
int main()
{
    int n,i,j,c;
    cout<<"Input a number =";
    cin>>n;
    for( i=2 ; i <= n ; i++)
    {
        c=0;
        for( j=2 ; j<= i/2 ; j++)
        {
            if(i%j==0)
            {
                c++;
                break;
            }
        }
        if(c==0)
        {
            cout<<i<<"\t";
        }
    }
}
